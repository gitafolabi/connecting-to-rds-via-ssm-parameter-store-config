import {
  ISecurityGroup,
  IVpc,
  Peer,
  Port,
  SecurityGroup,
} from "aws-cdk-lib/aws-ec2";
import { Duration, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { IRepository } from "aws-cdk-lib/aws-ecr";
import {
  Cluster,
  ContainerDefinition,
  CpuArchitecture,
  EcrImage,
  FargateService,
  FargateTaskDefinition,
  OperatingSystemFamily,
  LogDriver,
} from "aws-cdk-lib/aws-ecs";
import {
  ApplicationLoadBalancer,
  ApplicationProtocol,
  ApplicationProtocolVersion,
  ListenerAction,
  SslPolicy,
} from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { IDatabaseInstance } from "aws-cdk-lib/aws-rds";
import { CERTIFICATE_ARN } from "../config";

interface Props extends StackProps {
  vpc: IVpc;
  repository: IRepository;
  rds: IDatabaseInstance;
  securityGroup: ISecurityGroup;
}

const CONTAINER_PORT = 8081;

export class ElasticContainerStack extends Stack {
  public readonly loadBalancer: ApplicationLoadBalancer;
  public readonly container: ContainerDefinition;
  public readonly service: FargateService;
  public readonly cluster: Cluster;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);
    this.cluster = new Cluster(this, "exanubes-cluster", {
      vpc: props.vpc,
      clusterName: "exanubes-cluster",
      containerInsights: true,
    });

    const albSg = new SecurityGroup(this, "security-group-load-balancer", {
      vpc: props.vpc,
      allowAllOutbound: true,
    });
    albSg.addIngressRule(Peer.anyIpv4(), Port.tcp(443));

    this.loadBalancer = new ApplicationLoadBalancer(this, "exanubes-alb", {
      vpc: props.vpc,
      loadBalancerName: "exanubes-ecs-alb",
      internetFacing: true,
      idleTimeout: Duration.minutes(10),
      securityGroup: albSg,
      http2Enabled: false,
      deletionProtection: false,
    });

    const httpListener = this.loadBalancer.addListener("http listener", {
      port: 80,
      open: true,
      defaultAction: ListenerAction.redirect({
        port: "443",
        protocol: ApplicationProtocol.HTTPS,
      }),
    });

    const sslListener = this.loadBalancer.addListener("secure https listener", {
      port: 443,
      open: true,
      sslPolicy: SslPolicy.RECOMMENDED,
      certificates: [{ certificateArn: CERTIFICATE_ARN }],
    });

    const targetGroup = sslListener.addTargets("tcp-listener-target", {
      targetGroupName: "tcp-target-ecs-service",
      protocol: ApplicationProtocol.HTTP,
      protocolVersion: ApplicationProtocolVersion.HTTP1,
    });

    const taskRole = new Role(this, "exanubes-fargate-application-role", {
      assumedBy: new ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    props.rds.grantConnect(taskRole);
    const taskDefinition = new FargateTaskDefinition(
      this,
      "fargate-task-definition",
      {
        runtimePlatform: {
          cpuArchitecture: CpuArchitecture.ARM64,
          operatingSystemFamily: OperatingSystemFamily.LINUX,
        },
        taskRole,
      }
    );

    this.container = taskDefinition.addContainer("web-server", {
      image: EcrImage.fromEcrRepository(props.repository),
      logging: LogDriver.awsLogs({ streamPrefix: "exanubes-web-server" }),
    });
    this.container.addPortMappings({
      containerPort: CONTAINER_PORT,
    });

    const securityGroup = new SecurityGroup(this, "http-sg", {
      vpc: props.vpc,
    });
    securityGroup.addIngressRule(
      Peer.securityGroupId(albSg.securityGroupId),
      Port.tcp(CONTAINER_PORT),
      "Allow inbound connections from ALB"
    );
    this.service = new FargateService(this, "dd", {
      cluster: this.cluster,
      assignPublicIp: false,
      taskDefinition,
      securityGroups: [securityGroup],
      desiredCount: 1,
      maxHealthyPercent: 100,
    });
    // note cannot add dbAccessSg due to circular dependency error
    this.service.connections.allowToDefaultPort(props.rds);
    targetGroup.addTarget(this.service);
  }
}
