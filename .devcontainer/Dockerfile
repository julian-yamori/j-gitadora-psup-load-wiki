FROM node:20.11-bullseye-slim

WORKDIR /workspace

RUN mkdir -p /workspace/node_modules
COPY package.json package-lock.json ./
RUN chown -R node:node ./

USER node

# RUN npm install
