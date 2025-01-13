FROM node:23 AS node-builder
FROM nginx:latest

# Install Node.js 
COPY --from=node-builder /usr/local /usr/local

COPY nginx /etc/nginx/

COPY startup.sh /app/startup.sh

# Server
EXPOSE 80

CMD ["/app/startup.sh"]
