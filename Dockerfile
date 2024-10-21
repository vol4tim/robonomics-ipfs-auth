FROM node:20.10-alpine3.18
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY dist ./dist
EXPOSE 5050
CMD [ "npm", "start"]
