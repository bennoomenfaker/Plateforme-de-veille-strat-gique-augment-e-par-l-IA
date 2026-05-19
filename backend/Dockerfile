FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
# Copier le schema AVANT prisma generate
COPY prisma ./prisma/
RUN npx prisma generate
COPY . .
# Re-générer après COPY . . pour s'assurer que tout est à jour
RUN npx prisma generate
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
