FROM node:18-alpine

WORKDIR /app

# Omit npm install if they already have node_modules or allow it
COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 4200

CMD ["npm", "start", "--", "--host", "0.0.0.0", "--disable-host-check"]
