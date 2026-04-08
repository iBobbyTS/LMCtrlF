from app import main as main_module


def test_main_runs_uvicorn_with_app_instance(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def fake_run(target, **kwargs) -> None:
        captured["target"] = target
        captured["kwargs"] = kwargs

    monkeypatch.setattr(main_module.uvicorn, "run", fake_run)

    main_module.main()

    assert captured["target"] is main_module.app
    assert captured["kwargs"] == {
        "host": main_module.settings.backend_host,
        "port": main_module.settings.backend_port,
        "reload": False,
    }
