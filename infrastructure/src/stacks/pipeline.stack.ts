import { SecretValue, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  BuildEnvironmentVariableType,
  BuildSpec,
  EventAction,
  FilterGroup,
  GitHubSourceCredentials,
  LinuxBuildImage,
  Project,
  Source,
} from "aws-cdk-lib/aws-codebuild";
import {
  ContainerDefinition,
  IBaseService,
  ICluster,
} from "aws-cdk-lib/aws-ecs";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { IRepository } from "aws-cdk-lib/aws-ecr";
import { Artifact, ArtifactPath, Pipeline } from "aws-cdk-lib/aws-codepipeline";
import {
  CodeBuildAction,
  EcsDeployAction,
  GitHubSourceAction,
  GitHubTrigger,
} from "aws-cdk-lib/aws-codepipeline-actions";
import {
  AWS_ACCESS_KEY,
  AWS_SECRET_ACCESS_KEY,
  DatabaseConfig,
  githubConfig,
  secretConfig,
} from "../config";
import { ISecurityGroup, IVpc } from "aws-cdk-lib/aws-ec2";
import { IDatabaseInstance } from "aws-cdk-lib/aws-rds";

interface Props extends StackProps {
  repository: IRepository;
  service: IBaseService;
  cluster: ICluster;
  container: ContainerDefinition;
  dbConfig: DatabaseConfig;
  vpc: IVpc;
  rds: IDatabaseInstance;
  securityGroup: ISecurityGroup;
}

export class PipelineStack extends Stack {
  constructor(scope: Construct, id: string, private readonly props: Props) {
    super(scope, id, props);
    new GitHubSourceCredentials(this, "code-build-credentials", {
      accessToken: SecretValue.secretsManager(secretConfig.id),
    });

    const source = Source.gitHub({
      owner: githubConfig.owner,
      repo: githubConfig.repo,
      webhook: true,
      webhookFilters: [
        FilterGroup.inEventOf(EventAction.PUSH).andBranchIs(
          githubConfig.branch
        ),
      ],
    });

    const buildProject = this.createBuildProject(props, source);

    const migrationProject = this.createMigrationProject(props, source);

    props.rds.grantConnect(migrationProject.grantPrincipal);

    buildProject.addToRolePolicy(
      new PolicyStatement({
        actions: ["secretsmanager:GetSecretValue"],
        resources: [secretConfig.arn],
      })
    );
    props.repository.grantPullPush(buildProject.grantPrincipal);

    const artifacts = {
      source: new Artifact("Source"),
      build: new Artifact("BuildOutput"),
    };

    const pipelineActions = {
      source: new GitHubSourceAction({
        actionName: "Github",
        owner: githubConfig.owner,
        repo: githubConfig.repo,
        branch: githubConfig.branch,
        oauthToken: SecretValue.secretsManager("github/cdk-pipeline"),
        output: artifacts.source,
        trigger: GitHubTrigger.WEBHOOK,
      }),
      build: new CodeBuildAction({
        actionName: "CodeBuild",
        project: buildProject,
        input: artifacts.source,
        outputs: [artifacts.build],
      }),
      deploy: new EcsDeployAction({
        actionName: "ECSDeploy",
        service: props.service,
        imageFile: new ArtifactPath(
          artifacts.build,
          "docker_image_definition.json"
        ),
      }),
      migrate: new CodeBuildAction({
        actionName: "dbMigrate",
        project: migrationProject,
        input: artifacts.source,
      }),
    };

    const pipeline = new Pipeline(this, "DeployPipeline", {
      pipelineName: `exanubes-pipeline`,
      stages: [
        { stageName: "Source", actions: [pipelineActions.source] },
        { stageName: "Build", actions: [pipelineActions.build] },
        { stageName: "Migrate", actions: [pipelineActions.migrate] },
        { stageName: "Deploy", actions: [pipelineActions.deploy] },
      ],
    });
  }

  private getBuildSpec() {
    return BuildSpec.fromObject({
      version: "0.2",
      env: {
        shell: "bash",
      },
      phases: {
        pre_build: {
          commands: [
            "echo logging in to AWS ECR",
            "aws --version",
            "echo $AWS_STACK_REGION",
            "echo $CONTAINER_NAME",
            "aws ecr get-login-password --region ${AWS_STACK_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_STACK_REGION}.amazonaws.com",
            "COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)",
            "echo $COMMIT_HASH",
            "IMAGE_TAG=${COMMIT_HASH:=latest}",
            "echo $IMAGE_TAG",
          ],
        },
        build: {
          commands: [
            "echo Build started on `date`",
            "echo Build Docker image",
            "docker build -f ${CODEBUILD_SRC_DIR}/backend/Dockerfile --build-arg region=${AWS_STACK_REGION} --build-arg clientId=${AWS_ACCESS_KEY} --build-arg clientSecret=${AWS_SECRET_ACCESS_KEY} -t ${REPOSITORY_URI}:latest ./backend",
            "docker tag ${REPOSITORY_URI}:latest ${REPOSITORY_URI}:${IMAGE_TAG}",
          ],
        },
        post_build: {
          commands: [
            "echo Build completed on `date`",
            "echo Push Docker image",
            "docker push ${REPOSITORY_URI}:latest",
            "docker push ${REPOSITORY_URI}:${IMAGE_TAG}",
            'printf "[{\\"name\\": \\"$CONTAINER_NAME\\", \\"imageUri\\": \\"$REPOSITORY_URI:$IMAGE_TAG\\"}]" > docker_image_definition.json',
          ],
        },
      },
      artifacts: {
        files: ["docker_image_definition.json"],
      },
    });
  }
  private createMigrationProject(props: Props, source: Source) {
    return new Project(this, "migration-project", {
      projectName: "migration-project",
      securityGroups: [props.securityGroup],
      vpc: props.vpc,
      buildSpec: this.getMigrationSpec(),
      source,
      environment: {
        buildImage: LinuxBuildImage.AMAZON_LINUX_2_ARM_2,
        privileged: true,
      },
      environmentVariables: {
        DB_USER: {
          value: props.dbConfig.username,
        },
        DB_PASSWORD: {
          value: props.dbConfig.password,
        },
        DB_HOST: {
          value: props.dbConfig.hostname,
        },
        DB_PORT: {
          value: props.dbConfig.port,
        },
        DB_NAME: {
          value: props.dbConfig.database,
        },
      },
    });
  }
  private getMigrationSpec() {
    return BuildSpec.fromObject({
      version: "0.2",
      env: {
        shell: "bash",
      },
      phases: {
        install: {
          commands: ["(cd ./backend && npm install)"],
        },
        build: {
          commands: [
            "./backend/node_modules/.bin/sequelize db:migrate --debug --migrations-path ./backend/db/migrations --url postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME}",
          ],
        },
      },
    });
  }

  private createBuildProject(props: Props, source: Source) {
    const stack = Stack.of(this);
    return new Project(this, "project", {
      projectName: "pipeline-project",
      buildSpec: this.getBuildSpec(),
      source,
      environment: {
        buildImage: LinuxBuildImage.AMAZON_LINUX_2_ARM_2,
        privileged: true,
      },
      environmentVariables: {
        REPOSITORY_URI: {
          value: props.repository.repositoryUri,
        },
        AWS_ACCOUNT_ID: {
          value: stack.account,
        },
        AWS_STACK_REGION: {
          value: stack.region,
        },
        GITHUB_AUTH_TOKEN: {
          type: BuildEnvironmentVariableType.SECRETS_MANAGER,
          value: secretConfig.arn,
        },
        CONTAINER_NAME: {
          value: props.container.containerName,
        },
        AWS_ACCESS_KEY: {
          value: AWS_ACCESS_KEY,
        },
        AWS_SECRET_ACCESS_KEY: {
          value: AWS_SECRET_ACCESS_KEY,
        },
      },
    });
  }
}
