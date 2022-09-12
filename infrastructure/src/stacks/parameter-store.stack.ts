ddimport {ParameterDataType, ParameterTier, StringParameter} from "aws-cdk-lib/aws-ssm";
import {Stack, StackProps} from "aws-cdk-lib";
import {Construct} from "constructs";
import {SecureStringParameter} from "@exanubes/aws-cdk-ssm-secure-string-parameter";
import {DatabaseConfig} from "../config";

interface Props extends StackProps {
    dbConfig: DatabaseConfig;
}

export class ParameterStoreStack extends Stack {
    constructor(scope: Construct, id: string, props: Props) {
        super(scope, id, props);
        new SecureStringParameter(this, 'database-password', {
            parameterName: '/production/database/password',
            stringValue: props.dbConfig.password,
            tier: ParameterTier.STANDARD,
            dataType: ParameterDataType.TEXT,
        });
        new StringParameter(this, 'database-user', {
            parameterName: '/production/database/username',
            stringValue: props.dbConfig.username,
            tier: ParameterTier.STANDARD,
            dataType: ParameterDataType.TEXT,
        });
        new StringParameter(this, 'database-hostname', {
            parameterName: '/production/database/hostname',
            stringValue: props.dbConfig.hostname,
            tier: ParameterTier.STANDARD,
            dataType: ParameterDataType.TEXT,
        });
        new StringParameter(this, 'database-port', {
            parameterName: '/production/database/port',
            stringValue: String(props.dbConfig.port),
            tier: ParameterTier.STANDARD,
            dataType: ParameterDataType.TEXT,
        });
        new StringParameter(this, 'database-socket-address', {
            parameterName: '/production/database/socketAddress',
            stringValue: props.dbConfig.socketAddress,
            tier: ParameterTier.STANDARD,
            dataType: ParameterDataType.TEXT,
        });
        new StringParameter(this, 'database-database', {
            parameterName: '/production/database/name',
            stringValue: props.dbConfig.database,
            tier: ParameterTier.STANDARD,
            dataType: ParameterDataType.TEXT,
        });
    }
}

