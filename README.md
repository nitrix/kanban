# kanban

![](screenshot.png)

A real-time & persistent kanban board.

## Usage

This is meant to be used by a single user only. 
Run locally with `go run` or on Docker with `docker run -p 80 -e USERNAME=test -e PASSWORD=test ghcr.io/nitrix/kanban`.

## Feature flags

| Name                | Description                           | Default |
|---------------------|---------------------------------------|---------|
| FEATURE_STAY_LOGGED | Stays logged in via a browser cookie. | false   |

## Persistent storage

By default, SQLite is used for local storage, meaning it's probably a good idea to mount a volume at `/opt/data` for
where `/opt/data/kanban.db` will reside to not loose your data.

Alternatively, you can use an external Postgres database by mounting SSL certificates at `/opt/certs` and playing with the environment variables:

| Name               | Default          | Example          |
|--------------------|------------------|------------------|
| POSTGRES_ENABLED   | false            | true             |
| POSTGRES_HOSTNAME  | localhost        | cockroachdb      |
| POSTGRES_DATABASE  | kanban           | nitrix           |
| POSTGRES_USERNAME  | kanban           | nitrix           |
| POSTGRES_PORT      | 5432             | 26257            |
| POSTGRES_CA_PATH   | certs/ca.crt     | certs/ca.crt     |
| POSTGRES_KEY_PATH  | certs/kanban.key | certs/nitrix.key |
| POSTGRES_CERT_PATH | certs/kanban.crt | certs/nitrix.crt |

## Disclaimer

The code was put together in a hurry (less than a day) and is an absolute disaster.

## License

This is free and unencumbered software released into the public domain. See the [UNLICENSE](UNLICENSE) file for more details.
