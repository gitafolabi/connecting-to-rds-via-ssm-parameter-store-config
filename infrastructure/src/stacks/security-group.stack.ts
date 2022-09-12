import { IVpc, Port, SecurityGroup } from "aws-cdk-lib/aws-ec2";
import {Stack, StackProps, Token} from "aws-cdk-lib";
import { Construct } from "constructs";

interface Props extends StackProps {
  vpc: IVpc;
}

export class SecurityGroupStack extends Stack {
  databaseSg: SecurityGroup;
  databaseAccessSg: SecurityGroup;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);
    this.databaseAccessSg = new SecurityGroup(this, "database-access-sg", {
      vpc: props.vpc,
      description:
        "Security group for resources that need access to rds database instance",
    });

    this.databaseSg = new SecurityGroup(this, "database-sg", {
      vpc: props.vpc,
      description: "Security group for rds database instance",
    });

    this.databaseSg.addIngressRule(
      this.databaseAccessSg,
      Port.tcp(5432),
      `Allow inbound connection on port 5432 for resources with database-access-sg security group`
    );
  }
}
