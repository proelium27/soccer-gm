# soccer-gm

## Git workflow
- Always keep work committed: after making code changes, commit them locally with a clear message rather than leaving the working tree dirty.
- Always keep the remote in sync: after committing, push to GitHub (`origin`) so local `main` and GitHub `main` never drift apart.
- Merging isn't finished until it's in both places: when a PR is merged on GitHub, also pull that merge into the local `main` branch (`git checkout main && git pull`) so the local checkout matches GitHub. Don't consider a change "done" until local `main` and GitHub `main` both have it.
- Only skip this (leave changes uncommitted/unpushed/unpulled) if the user explicitly asks you to hold off.
