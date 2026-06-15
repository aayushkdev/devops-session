# Getting Started With DevOps

## Overview

This guide walks through the DevOps concepts used in this demo project:

- Docker
- Docker Compose
- Nginx as a reverse proxy
- VPS deployment
- CI/CD with GitHub Actions

---

## The Problem Docker Solves

Before explaining Docker, it helps to understand the problem Docker is trying to solve.

Imagine an app built in PHP on a specific Linux environment.

Maybe it needs a specific PHP version, extensions, system packages, and some setup that was done during development.

On the original development machine, the app works perfectly.

Now imagine sharing this app with someone using Windows, which is a completely different system.

The problem becomes: how does that person run this app?

Because the code alone is not enough.

The app also needs the correct environment.

It needs the right PHP version, the right extensions, the right dependencies, and the right commands.

So the real problem becomes: how do we replicate the environment our software needs on any machine?

One way to solve this is using a virtual machine.

That works, but VMs are heavy.

They run a full guest operating system, so they usually take more storage, more RAM, and more time to start.

Docker containers solve a similar problem, but in a lighter way.

A container is kind of similar to a VM in the sense that it gives the app an isolated environment.

But the key difference is that containers do not run a full separate operating system for every app.

Containers share the host machine’s kernel.

So instead of booting a full OS each time, Docker runs the app in an isolated environment with only the files, dependencies, and runtime it needs.

That makes containers much lighter and faster to start compared to VMs.

That is the basic idea.

To understand how Docker does this, there are three Docker terms to know:

Dockerfile, image, and container.

---

## Dockerfile, Image, Container

Start with the Dockerfile.

A Dockerfile is basically a file where we write the steps needed to set up and run our app.

For example, in a Dockerfile we can say which base image to use, which files to copy, which dependencies to install, which port the app uses, and which command should run when the container starts.

A Docker image is basically an immutable snapshot of our application along with everything it needs to run, such as dependencies, libraries, and configuration.

From this image, we can create one or more containers.

A container is simply a running instance of a Docker image. You can think of the image as the blueprint and the container as the actual running application.

To start a container, we use the docker run command. Docker takes the image and launches a container based on it, allowing the application to run in an isolated environment.

In real projects, Docker images can also be pushed to registries like Docker Hub or GitHub Container Registry. A registry is a place where Docker images are stored. This guide focuses mainly on building and running containers.

The backend Dockerfile is a good starting point because it is small and easy to understand.

---

## Backend Dockerfile

First line:

```Dockerfile
FROM python:3.13-slim
```

This means Python does not need to be installed manually inside the container.

The image starts from a base image where Python is already installed.

Next:

```Dockerfile
WORKDIR /app
```

This is basically like saying, inside the container, go to the `/app` folder.

Whatever commands we run after this will happen from this folder.

Now:

```Dockerfile
COPY requirements.txt .
RUN pip install -r requirements.txt
```

This copies only the dependency file first, and then installs the Python packages.

In our case, the main dependencies are FastAPI and Uvicorn.

Now after that:

```Dockerfile
COPY . .
```

This copies the rest of the backend code.

And this is a good place to explain why we copied in two steps.

Why not just copy everything at once?

The reason is Docker caching.

Docker builds images layer by layer.

If a layer has not changed, Docker can reuse it from cache.

In most apps, dependencies change less often than the actual application code. For example, we do not add a new Python package every time we change one line in `app.py`.

So this part:

```Dockerfile
COPY requirements.txt .
RUN pip install -r requirements.txt
```

creates a layer where the Python dependencies are installed.

Then `COPY . .` creates a later layer with the application code.

If only `app.py` changes, Docker can reuse the dependency layer. It does not need to install FastAPI, Uvicorn, and all the other packages again.

This matters a lot in bigger apps, because dependency installation can take proper time.

Some projects have many packages, native builds, or large dependencies, so reinstalling everything on every small code change would make builds painfully slow.

But if `requirements.txt` changes, Docker knows the dependency layer is no longer valid, so it reruns `pip install`.

So the short reason is: we copy in two steps to make rebuilds faster.

Now:

```Dockerfile
EXPOSE 5000
```

This is just documentation that this container listens on port 5000.

It does not automatically open the port on the host machine.

And finally:

```Dockerfile
CMD ["python", "app.py"]
```

This is the command that runs when the container starts.

So when the backend container starts, it runs `python app.py`.

And inside `app.py`, we start the FastAPI app using Uvicorn on port 5000.

Build the backend image:

```bash
docker build -t backend ./backend
```

Here, `-t backend` means we are giving the image the name `backend`.

To run this backend container by itself:

```bash
docker run -p 5000:5000 backend
```

The `-p 5000:5000` part means:

```text
localhost:5000 -> container:5000
```

The first port is the host machine’s port, and the second port is the container’s port.

Open:

```text
http://localhost:5000/api
```

This should return the health response.

Open:

```text
http://localhost:5000/api/status
```

This should return the backend status data that the frontend uses.

That is the backend running inside Docker.

---

## Frontend Dockerfile

Next, look at the frontend Dockerfile.

This is a React app built with Vite.

The same Dockerfile structure applies here.

First:

```Dockerfile
FROM node:24-slim
```

For the frontend, we need Node.js.

So we start from a Node image instead of installing Node manually.

Next:

```Dockerfile
WORKDIR /app
```

Again, same as backend.

Inside the container, we are working from the `/app` folder.

Now:

```Dockerfile
COPY package*.json ./
```

This copies `package.json` and `package-lock.json`.

These are copied first for the same caching reason.

The npm packages should not get downloaded again and again if only one React component changes.

Then:

```Dockerfile
RUN npm install
```

This installs the frontend dependencies.

After that:

```Dockerfile
COPY . .
```

This copies the rest of the React app.

Now we build it:

```Dockerfile
RUN npm run build
```

This creates the production build of the React app.

Then:

```Dockerfile
EXPOSE 3000
```

This tells us the frontend container is going to listen on port 3000.

And finally:

```Dockerfile
CMD ["npm", "start"]
```

This starts the frontend server.

In our `package.json`, `npm start` runs the built frontend on port 3000.

Build the frontend image:

```bash
docker build -t frontend ./frontend
```

To run only the frontend container:

```bash
docker run -p 3000:3000 frontend
```

Then open:

```text
http://localhost:3000
```

But this is only testing the frontend container by itself.

Our real app has two services: the frontend and the backend.

And if we expose both directly, users would have to know different ports for different parts of the app.

That’s not how we usually want a production app to work.

We want one clean entry point, and then internally the request should go to the correct service.

This is where Nginx comes in.

---

## Nginx

Nginx solves the routing problem for this multi-service app.

Before introducing Nginx, imagine that our frontend and backend are exposed separately.

Users would have to access:

http://myapp.com:3000

for the frontend, and:

http://myapp.com:5000

for the backend API.

This is not ideal because users need to know different ports, and we're exposing our internal services directly.

Instead, we want a cleaner setup where users only interact with a single entry point.

For example:

http://myapp.com

for the website, and:

http://myapp.com/api/status

for the API.

Both requests go to the same server, but Nginx decides where each request should go.

Nginx is a very powerful tool. It can act as a reverse proxy, perform load balancing, apply rate limiting, and route requests between services.

For this project, we are using Nginx as a reverse proxy.

A reverse proxy is basically something that sits between the client and our application. Instead of the browser communicating directly with the frontend or backend containers, it sends every request to Nginx first.

Nginx then examines the request and forwards it to the appropriate service.

Looking at the diagram:

1. A user sends a request to myapp.com.
2. The request first reaches Nginx.
3. If the request is for the website, Nginx forwards it to the frontend container running on port 3000.
4. If the request starts with /api, Nginx forwards it to the backend container running on port 5000.
5. The response is sent back through Nginx to the user.

This gives us a single public entry point while keeping the internal services hidden behind


The Nginx config starts with:

First:

```nginx
server {
    listen 80;
}
```

This means Nginx is listening on port 80, which is the normal HTTP port.

Now inside this `server` block, we add routes.

First, API routes:

```nginx
server {
    listen 80;

    location /api {
        proxy_pass http://backend:5000;
    }
}
```

So if the browser calls `/api` or `/api/status`, Nginx will forward that request to the backend container.

Because `/` is the general route. Almost every URL starts with `/`.

Notice this uses `backend`, not an IP address.

This works because Docker Compose lets services talk to each other using service names.

Now for everything else:

```nginx
server {
    listen 80;

    location /api {
        proxy_pass http://backend:5000;
    }

    location / {
        proxy_pass http://frontend:3000/;
    }
}
```

One small question here is: why write `/api` before `/`?

For this simple Nginx config, Nginx will choose the more specific prefix, so `/api` wins over `/`.

Writing the specific route first is easier to read: API requests go here, and `/` is the fallback for normal frontend pages.

Basically, the user only sees one URL, but internally Nginx is deciding whether the request should go to frontend or backend.

So:

```text
http://localhost/api/status
```

will go to:

```text
backend:5000/api/status
```

Then:

```nginx
location /
```

goes to the frontend.

So:

```text
http://localhost
```

goes to:

```text
frontend:3000
```

Now one thing you might notice is this:

```text
frontend
backend
```

These are not public domains.

These are going to be the names of our containers or services.

And in a minute, when we use Docker Compose, this will make more sense.

So Nginx solves our routing problem.

Users don’t need to know that the frontend is on port 3000 and the backend is on port 5000.

They just hit one entry point, and Nginx forwards the request to the correct service.

But now we have a new problem.

To make this setup work, we need to run three containers together.

We need the frontend container.

We need the backend container.

And we need the Nginx container.

If all of these are run manually with `docker run`, ports, networks, container names, startup order, and commands all have to be managed separately.

That gets messy very quickly.

So the next problem is: how do we define and run this whole multi-container app in one place?

That is exactly what Docker Compose solves.

---

## Docker Compose

Docker Compose lets us define the whole app in one file.

Now we do not want to run backend, frontend, and Nginx manually one by one.

That is why we use Docker Compose.

The simple way to remember this is:

```text
Dockerfile = how to build one service
docker-compose.yml = how to run the whole application
```

The `docker-compose.yml` starts with:

First:

```yaml
services:
```

This means multiple containers are being defined as part of one app.

Now first service, frontend:

```yaml
services:
  frontend:
    build: ./frontend
    depends_on:
      - backend
```

This means build the frontend image from the `frontend` folder.

So Compose will look inside `./frontend`, find the Dockerfile there, and build that service from it.

The full frontend Dockerfile is not repeated here.

That logic already exists inside `frontend/Dockerfile`.

Compose is just saying: use that Dockerfile to build this service.

And frontend depends on backend because the frontend calls the backend API.

Now backend:

```yaml
services:
  frontend:
    build: ./frontend
    depends_on:
      - backend

  backend:
    build: ./backend
```

Same idea here.

The backend image is built from the `backend` folder.

Again, Compose will use the backend Dockerfile from earlier.

Now after frontend and backend, we define Nginx manually:

```yaml
services:
  frontend:
    build: ./frontend
    depends_on:
      - backend

  backend:
    build: ./backend

  nginx:
    image: nginx:alpine
```

Here there is no Dockerfile for Nginx in our project.

We are directly using the official Nginx image.

Now:

```yaml
services:
  frontend:
    build: ./frontend
    depends_on:
      - backend

  backend:
    build: ./backend

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
```

This part is important.

Only Nginx is exposed publicly.

So outside world talks to port 80, and Nginx handles where the request goes.

Now we mount our Nginx config:

```yaml
services:
  frontend:
    build: ./frontend
    depends_on:
      - backend

  backend:
    build: ./backend

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
```

This takes our local `nginx/default.conf` file and puts it inside the Nginx container.

The left side is our file:

```text
./nginx/default.conf
```

This is the Nginx config file in the project.

The right side is where Nginx expects config files inside the container:

```text
/etc/nginx/conf.d/default.conf
```

This means: take the local config file and place it inside the Nginx container at the location where Nginx reads configs.

The `ro` means read-only.

So the container can read this config, but it cannot modify it.

This is how our custom Nginx routing config actually gets inside the Nginx container.

Then:

```yaml
services:
  frontend:
    build: ./frontend
    depends_on:
      - backend

  backend:
    build: ./backend

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - frontend
      - backend
```

This tells Compose that Nginx depends on frontend and backend.

So when we start the app, Compose knows these services are related.

Now the nice part is this.

The frontend and backend do not have any `ports` section.

So they are not directly exposed publicly.

Only Nginx is exposed.

Docker Compose also automatically creates a private network for these services.

Inside that network, services can talk to each other using their service names.

So Nginx can call:

```text
frontend:3000
```

and:

```text
backend:5000
```

These names come from the service names in `docker-compose.yml`.

Now to run everything:

```bash
docker compose up -d --build
```

`--build` means build the images again if needed.

`-d` means detached mode, so containers run in the background.

Then we can check the containers with:

```bash
docker compose ps
```

We can see logs with:

```bash
docker compose logs
```

And to stop everything:

```bash
docker compose down
```

So Docker Compose makes it easy to run the whole app together.

At this point, we can open:

```text
http://localhost
```

and the request goes to Nginx first.

Then Nginx sends website requests to the frontend, and API requests to the backend.

---

## Moving To A VPS

At this point, the app runs locally using Docker Compose.

But users cannot access a local laptop.

So we need a machine that is always online and publicly reachable.

That is where a VPS comes in.

A VPS is basically a remote Linux server with a public IP address.

For this guide, assume the VPS is already set up with the required dependencies:

- Docker installed
- Docker Compose installed
- Git installed
- Port 80 open

So now the nice part is this.

Because our app is already dockerized, the server does not need to know too many app-specific details.

It just needs the code and Docker Compose.

So the manual deployment process looks like this:

```bash
ssh user@server-ip
cd ~/devops-session
git pull origin main
docker compose up -d --build
```

First:

```bash
ssh user@server-ip
```

This connects to the remote server.

Then:

```bash
cd ~/devops-session
```

This goes into the project folder.

Then:

```bash
git pull origin main
```

This pulls the latest code from GitHub.

Then:

```bash
docker compose up -d --build
```

This rebuilds and restarts the containers.

After that, the app should be available at:

```text
http://server-ip
```

So at this point, we have deployed the app.

But the deployment is still manual.

Now imagine this is a real project.

Every time someone merges a pull request, or every time a new change is pushed to `main`, someone would have to log in to the VPS again.

The same commands would need to be run:

```bash
git pull origin main
docker compose up -d --build
```

again and again.

If one step is missed, or the wrong command is run, deployment can break.

Also, there is no automatic check before deployment.

So the problem now is: how do we make this process automatic?

How do we say: whenever code is pushed to `main`, first check that the app builds, and only then deploy it to the server?

That is where CI/CD comes in.

---

## CI/CD

CI/CD automates the manual deployment process.

At this point, our application is already deployed on a VPS.

But there's still a problem.

Every time a change is made, someone has to manually SSH into the server, pull the latest code, and restart the containers.

That might be okay once or twice, but imagine doing that every single day on a real project.

It's repetitive, easy to forget, and easy to mess up.

So the question becomes:

Can we automate this process?

That is exactly what CI/CD is for.

CI stands for Continuous Integration.

CD stands for Continuous Deployment (or sometimes Continuous Delivery).

You don't need to remember the full names.

Just remember this:

CI checks that our changes are valid.

CD deploys those changes automatically.

For example, in a real project, a CI pipeline might:

- Run unit tests
- Run linting
- Run type checking
- Check formatting
- Build the application
- Build Docker images

The goal is simple:

Before deploying anything, make sure the application still works.

If something is broken, we want to find out immediately instead of deploying a broken version to production.

Now CD is the next step.

Once all those checks pass, CD takes care of releasing the application.

Depending on the project, that could mean:

- Restarting Docker Compose on a VPS
- Deploying to a cloud platform
- Publishing a package to NPM
- Publishing a Python package to PyPI
- Building installers for Windows, macOS, and Linux
- Deploying a mobile app

So CI verifies.

CD releases.

In our project, we're keeping things simple.

Our CI job will build the frontend and backend Docker images.

If those builds succeed, then our CD job will connect to the VPS and run the deployment commands automatically.


Now to set up CI/CD, we need to define a workflow file so GitHub knows exactly what steps to execute when our code is pushed.

```yaml
name: CI/CD Deploy

on:
  push:
    branches:
      - main

jobs:
  ci:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Build backend image
        run: docker build -t devops-session-backend ./backend

      - name: Build frontend image
        run: docker build -t devops-session-frontend ./frontend

  cd:
    runs-on: ubuntu-latest
    needs: ci

    steps:
      - name: Deploy to VPS
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd ~/devops-session
            git pull origin main
            docker compose up -d --build

```

```yaml
name: CI/CD Deploy

on:
  push:
    branches:
      - main
```

This means the workflow runs when we push code to the `main` branch.

Then we have the CI job:

```yaml
jobs:
  ci:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Build backend image
        run: docker build -t devops-session-backend ./backend

      - name: Build frontend image
        run: docker build -t devops-session-frontend ./frontend
```

So GitHub gives us a temporary Ubuntu machine.

Then it checks out the code.

Then it builds the backend image.

Then it builds the frontend image.

If either of these builds fail, the CI job fails.

And if CI fails, deployment should not happen.

Then we have the CD job:

```yaml
cd:
  runs-on: ubuntu-latest
  needs: ci

  steps:
    - name: Deploy to VPS
      uses: appleboy/ssh-action@v1.0.3
      with:
        host: ${{ secrets.SERVER_HOST }}
        username: ${{ secrets.SERVER_USER }}
        key: ${{ secrets.SERVER_SSH_KEY }}
        script: |
          cd ~/devops-session
          git pull origin main
          docker compose up -d --build
```

The most important line here is:

```yaml
needs: ci
```

This means the deploy job will only run after the CI job passes.

So if the Docker images do not build, the app will not be deployed.

Inside the deploy step, GitHub Actions connects to the VPS using SSH.

Then it runs the same commands used in the manual deployment process:

```bash
cd ~/devops-session
git pull origin main
docker compose up -d --build
```

So CI/CD is not magic.

We first understood the manual deployment process.

Then we automated those same commands using GitHub Actions.

The workflow also uses these values:

```text
SERVER_HOST
SERVER_USER
SERVER_SSH_KEY
```

These are GitHub Secrets.

We use secrets because we should not write private keys or server details directly in our code.

So GitHub Actions can access these values, but they are not visible in the repository.

---

## Deployment Flow

To verify the full deployment flow, make a small frontend change, commit it, and push it to `main`:

```bash
git add .
git commit -m "Update homepage text"
git push origin main
```

After the push, GitHub Actions should start.

First, the CI job runs.

It builds the Docker images.

Then, once CI passes, the CD job starts.

The CD job connects to the VPS.

It pulls the latest code.

It runs Docker Compose.

And then the app gets updated.

Refresh the deployed website. The new change should be visible after the workflow finishes.

The full flow is:

- Code change
- Git push
- CI build
- CD deployment
- VPS update
- Nginx routes traffic
- App is live

---

## Summary

This project demonstrates a complete basic DevOps workflow:

- Docker packages the frontend and backend into containers.
- Docker Compose runs the multi-container app locally or on a server.
- Nginx provides one public entry point and routes traffic internally.
- A VPS hosts the application.
- GitHub Actions automates build checks and deployment.
