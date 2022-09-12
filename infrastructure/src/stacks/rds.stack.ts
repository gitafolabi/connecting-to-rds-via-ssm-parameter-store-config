import {
  InstanceClass,
  InstanceSize,
  InstanceType,
  IVpc,
  SecurityGroup,
} from "aws-cdk-lib/aws-ec2";
import {
  DatabaseInstance,
  DatabaseInstanceEngine,
  ParameterGroup,
  StorageType,
} from "aws-cdk-lib/aws-rds";
import { SecretValue, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { DatabaseConfig } from "../config";

interface Props extends StackProps {
  vpc: IVpc;
  dbConfig: Pick<DatabaseConfig, "database" | "username" | "password">;
  securityGroup: SecurityGroup;
}

export class RdsStack extends Stack {
  public readonly db: DatabaseInstance;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    this.db = new DatabaseInstance(this, "exanubes-database", {
      engine: DatabaseInstanceEngine.POSTGRES,
      vpc: props.vpc,
      credentials: {
        username: props.dbConfig.username,
        password: SecretValue.plainText(props.dbConfig.password),
      },
      databaseName: props.dbConfig.database,
      storageType: StorageType.STANDARD,
      instanceType: InstanceType.of(
          InstanceClass.BURSTABLE3,
          InstanceSize.SMALL
      ),
      parameterGroup: ParameterGroup.fromParameterGroupName(
        this,
        "postgres-instance-group",
        "postgresql13"
      ),
      securityGroups: [props.securityGroup],
    });
  }
}
