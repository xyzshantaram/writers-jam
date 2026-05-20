FROM denoland/deno:alpine-2.7.14 AS builder

WORKDIR /app

COPY deno.json deno.lock ./
COPY src/ ./src/
COPY public/ ./public/
COPY templates/ ./templates/
COPY data/ ./data/

RUN deno cache --unstable-raw-imports src/main.ts

FROM denoland/deno:alpine-2.7.14

WORKDIR /app

COPY --from=builder /app/deno.json /app/deno.lock ./
COPY --from=builder /app/src/ ./src/
COPY --from=builder /app/public/ ./public/
COPY --from=builder /app/templates/ ./templates/
COPY --from=builder /app/data/ ./data/

RUN deno cache --unstable-raw-imports src/main.ts

USER deno

EXPOSE 8000

CMD ["run", "-A", "--unstable-raw-imports", "src/main.ts"]
