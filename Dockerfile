FROM golang:alpine as builder

RUN apk add git gcc musl-dev

WORKDIR /go/src
COPY . .
RUN CGO_ENABLED=1 GOOS=linux go build -a -ldflags '-linkmode external -extldflags "-static"' .

FROM scratch
COPY --from=builder /go/src/kanban /usr/bin/kanban
COPY --from=builder /go/src/schema.sql /opt/schema.sql
COPY --from=builder /go/src/index.html /opt/index.html
COPY --from=builder /go/src/static /opt/static
WORKDIR /opt
ENTRYPOINT ["/usr/bin/kanban"]