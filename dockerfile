FROM node:23 AS node-builder

COPY startup.sh /app/startup.sh

# Server
EXPOSE 30000
EXPOSE 30001

CMD ["/app/startup.sh"]
