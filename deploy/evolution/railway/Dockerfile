FROM atendai/evolution-api:v2.2.3

WORKDIR /evolution

COPY deploy/evolution/railway/start-evolution.sh /usr/local/bin/start-evolution.sh
RUN chmod +x /usr/local/bin/start-evolution.sh

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/start-evolution.sh"]
