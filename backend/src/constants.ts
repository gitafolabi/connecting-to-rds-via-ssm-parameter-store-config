export const isProd = process.env.NODE_ENV === 'production';

export const region = String(process.env.region);
export const clientId = String(process.env.clientId);
export const clientSecret = String(process.env.clientSecret);
