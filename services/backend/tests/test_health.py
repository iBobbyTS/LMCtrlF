from fastapi.testclient import TestClient


def test_health_returns_ok_status(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_unknown_route_returns_not_found(client: TestClient) -> None:
    response = client.get("/missing")

    assert response.status_code == 404


def test_health_allows_local_renderer_origin(client: TestClient) -> None:
    response = client.get("/health", headers={"Origin": "http://127.0.0.1:5173"})

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5173"
