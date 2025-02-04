FROM node:23 AS node-builder

COPY startup.sh /app/startup.sh
RUN ls -la /app

# Server
EXPOSE 30000
EXPOSE 30001

RUN ls -la /app
CMD ["/app/startup.sh"]
