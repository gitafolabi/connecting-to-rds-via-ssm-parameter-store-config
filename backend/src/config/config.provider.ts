import {
  SSMClient,
  Parameter,
  GetParametersByPathCommand,
} from '@aws-sdk/client-ssm';
import { set } from 'lodash';
import { config } from './config.consts';
import { clientId, clientSecret, isProd, region } from '../constants';

export const getConfig = async () => {
  console.log('@REGION', region, isProd);
  if (!isProd) {
    return config;
  }
  const client = new SSMClient({
    region: region,
    credentials: {
      accessKeyId: clientId,
      secretAccessKey: clientSecret,
    },
  });
  const command = new GetParametersByPathCommand({
    Path: '/production',
    Recursive: true,
    WithDecryption: true,
  });
  const result = await client.send(command);
  return transformParametersIntoConfig(result.Parameters || []);
};

function transformParametersIntoConfig(params: Parameter[]): any {
  console.log('@params', params);
  return params.reduce((config: any, param: any) => {
    const path = param.Name.substring(1)
      .replace(/\//g, '.')
      .split('.')
      .splice(1)
      .join('.');
    return set(config, path, param.Value);
  }, {});
}
