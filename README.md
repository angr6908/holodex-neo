# holodex-neo

A high-performance Vue 3 remake of Holodex, migrating from legacy Vue 2/Vuetify to Vite, Shadcn Vue, and Tailwind v4.

### Demo

https://001920.xyz

🚧 Still under heavy development; the demo might not be the latest version.

### Quick Start (Docker)

```bash
docker pull unmol637/holodex-neo:latest
docker run -d -p 8080:80 unmol637/holodex-neo:latest
```

Or with Docker Compose:

```yaml
services:
  holodex-neo:
    image: unmol637/holodex-neo:latest
    container_name: holodex-neo
    ports:
      - "8080:80"
    restart: always
```

### License

MIT License. Content powered by Holodex API.
