#!/bin/bash
export PYTHONHOME=
export PYTHONPATH=
case "$1" in
    install|uninstall|sync|list)
        exec uv pip "$1" --system "${@:2}"
        ;;
    *)
        exec uv pip "$@"
        ;;
esac
