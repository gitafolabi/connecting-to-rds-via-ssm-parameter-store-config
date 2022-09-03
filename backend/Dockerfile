FROM node:14.15.0

COPY . .

RUN npm install
RUN NODE_ENV=production npm run build

EXPOSE 8081

ARG clientId
ARG region
ARG clientSecret

ENV NODE_ENV=production
ENV region=$region
ENV clientId=$clientId
ENV clientSecret=$clientSecret

ENTRYPOINT ["node"]

CMD ["dist/main.js"]
