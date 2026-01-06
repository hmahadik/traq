//go:build linux

package main

/*
#cgo CFLAGS: -pthread
#cgo LDFLAGS: -ldl

#define _GNU_SOURCE
#include <dlfcn.h>
#include <errno.h>
#include <signal.h>
#include <stdio.h>
#include <string.h>

// Pointer to the real sigaction function
static int (*real_sigaction)(int, const struct sigaction *, struct sigaction *) = NULL;

// Our wrapper for sigaction that adds SA_ONSTACK to all handlers
int sigaction(int signum, const struct sigaction *act, struct sigaction *oldact)
{
    // Get the real sigaction on first call
    if (real_sigaction == NULL) {
        real_sigaction = dlsym(RTLD_NEXT, "sigaction");
        if (real_sigaction == NULL) {
            fprintf(stderr, "traq: failed to find real sigaction: %s\n", dlerror());
            errno = ENOSYS;
            return -1;
        }
    }

    // If we're just querying or act is NULL, pass through
    if (act == NULL) {
        return real_sigaction(signum, act, oldact);
    }

    // Create a modified copy of the action with SA_ONSTACK added
    struct sigaction modified_act = *act;
    modified_act.sa_flags |= SA_ONSTACK;

    return real_sigaction(signum, &modified_act, oldact);
}

// Also intercept signal() which some libraries use
typedef void (*sighandler_t)(int);

sighandler_t signal(int signum, sighandler_t handler)
{
    struct sigaction act, oldact;

    if (handler == SIG_DFL || handler == SIG_IGN) {
        act.sa_handler = handler;
    } else {
        act.sa_handler = handler;
    }
    sigemptyset(&act.sa_mask);
    act.sa_flags = SA_ONSTACK | SA_RESTART;

    if (sigaction(signum, &act, &oldact) < 0) {
        return SIG_ERR;
    }

    return oldact.sa_handler;
}
*/
import "C"

// This file intercepts sigaction and signal calls from any library
// (including WebKit/GTK) and ensures they always include SA_ONSTACK.
// This prevents the "non-Go code set up signal handler without SA_ONSTACK flag" crash.
