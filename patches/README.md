# Dependency patches

`pg-cloudflare@1.4.1.patch` backports the pending-read shutdown guard proposed in
https://github.com/brianc/node-postgres/pull/3806 for the bug documented at
https://github.com/brianc/node-postgres/issues/3805.

After local or peer closure, the socket read loop settles instead of reporting
the already-closed socket as a new error. Read failures on an active connection
still reject. Source, runtime JavaScript and private declarations are patched
together; the package remains on its existing version and MIT license.

Remove the patch when upgrading to a release containing the upstream fix, and
keep the socket regression tests in CI.
