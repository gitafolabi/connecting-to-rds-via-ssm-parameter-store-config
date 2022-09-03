import {ARecord, HostedZone, RecordTarget} from "aws-cdk-lib/aws-route53";
import {IApplicationLoadBalancer} from "aws-cdk-lib/aws-elasticloadbalancingv2";
import {Stack, StackProps} from "aws-cdk-lib";
import {Construct} from "constructs";
import * as targets from 'aws-cdk-lib/aws-route53-targets'

interface Props extends StackProps {
    loadBalancer: IApplicationLoadBalancer
}

const HOSTED_ZONE_ID = "EXANUBES_REPLACE_VALUE"
export class Route53Stack extends Stack {
    constructor(scope: Construct, id: string, props: Props) {
        super(scope, id, props)
        const hostedZone = HostedZone.fromHostedZoneAttributes(
            this,
            "hosted-zone",
            {
                hostedZoneId: HOSTED_ZONE_ID,
                zoneName: "EXANUBES_REPLACE_VALUE",
            }
        )

        new ARecord(this, "ecs-alb-alias-record", {
            zone: hostedZone,
            target: RecordTarget.fromAlias(
                new targets.LoadBalancerTarget(props.loadBalancer)
            ),
        })

    }
}

