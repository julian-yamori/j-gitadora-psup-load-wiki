FROM node:20.11-bullseye-slim

WORKDIR /workspace

RUN apt-get update \
 && apt-get install -y \
    ca-certificates \
    git \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /workspace/node_modules
COPY package.json package-lock.json ./
RUN chown -R node:node ./

USER node

# RUN npm install
