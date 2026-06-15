from fastapi import FastAPI


app = FastAPI(title="DevOps Status Dashboard API")


@app.get("/api")
def health():
    return {"status": "healthy"}


@app.get("/api/status")
def status():
    return {
        "frontend": "React frontend is running.",
        "backend": "FastAPI backend is healthy.",
        "deployment": "Dockerized app is ready for CI/CD.",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=5000)
