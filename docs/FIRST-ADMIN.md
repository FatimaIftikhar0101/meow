# Creating the first administrator

Who this is for: whoever installs Meow for the company. It is done **once**, at
setup, and never again.

---

## The problem it solves

Every back-office account is created by an administrator. That works for the
second person onwards, and not at all for the first — there is nobody inside the
system yet to do the creating.

Some products solve this by shipping a default account like `admin/admin`. That
is how systems get broken into, because the default is the same everywhere and
somebody always forgets to change it. Meow has no default account and no default
password. It starts genuinely empty.

Instead, the first administrator is appointed **from outside the system**, by
whoever controls the servers. That person can already read the database and
change the code, so they can already do anything an administrator could. Letting
them appoint the first one grants no new power — it just makes an authority that
already exists explicit and recorded.

---

## How to do it

**1. Run one command** on the machine that has access to the deployment:

```
railway run npm run staff:bootstrap -- name@company.com
```

**2. It prints a six-digit code:**

```
created name@company.com as administrator

    setup code:  795370

  Valid for 15 minutes, and usable once.
```

**3. Give that code to the person.** Read it out, or hand them the screen. It is
not emailed — see below.

**4. They open the back office**, click **"I have a setup code"** on the sign-in
screen, and enter three things: their email address, the code, and a password
they choose themselves.

**5. They set up two-factor authentication.** An authenticator app on their
phone — Google Authenticator, Microsoft Authenticator, 1Password, any of them.
This is not optional and cannot be skipped: until it is done, the only screen a
staff account can reach is the enrolment screen.

That is the whole process. It takes about two minutes.

---

## Why the code is not emailed

Three reasons, in order of how much they matter.

**The person creating the account is standing next to the person receiving it.**
Staff are hired, not signed up. There is no reason to route six digits through
the internet and back when two colleagues can simply speak.

**Email is the weakest link in the chain.** A code sitting in an inbox can be
filtered into spam, forwarded, read by anyone who has the person's phone, or
fetched automatically by a security scanner. Nothing that is never sent can be
intercepted.

**Mail may not work yet.** This command runs before anyone has signed in, often
before the mail provider is even configured. Making the first administrator
depend on working email means discovering it is broken at the worst moment.

---

## Why the code is only six digits

Six digits is a million combinations, which sounds small. It is safe here
because of three things around it, and it would not be safe without any one of
them:

- **It only works for one specific account.** The email address is part of the
  request, so a guess is a guess against one person, not against every code in
  the system at once.
- **Five wrong attempts and the code is dead.** Not slowed down — finished. A
  new one has to be issued.
- **It expires in fifteen minutes.**

The code is also never stored. What the database holds is a one-way scramble of
it, so nobody — not the company, not a support engineer, not somebody who steals
the database — can read it back out. That is also why it is shown exactly once:
after the screen is closed, it genuinely cannot be recovered, and the account
has to be created again.

---

## Why it refuses to run twice

Run the command a second time and it stops:

```
1 administrator(s) already exist (name@company.com).
Invite further staff from the panel.
```

This is deliberate. The command is a way in from outside the system, so it must
be a door that is used once and then closed. After the first administrator
exists, every further account is created **inside the panel**, where the record
shows which named person granted the access and the reason they gave. A grant
made from a command line shows no such thing.

There is a `--force` flag for one situation only: everyone with administrator
access has genuinely lost it, and there is no way back in. It is a recovery
tool, not a convenience.

---

## Everyone after the first

The first administrator creates everyone else from **Staff & roles** in the
panel:

1. Click **Invite someone**, enter their email, choose their role, and give a
   reason. The reason is required — it goes into the audit log, which is what a
   compliance review reads.
2. The panel shows a six-digit setup code. Same rules as above: once, two hours
   to use it, cannot be looked up again.
3. Pass it to them. They claim it exactly the way the first administrator did.

Four roles exist, and each one can see only what its job requires:

| Role | What it is for |
|---|---|
| **Support** | Answering customer questions. Can look customers up; cannot change money or settings. |
| **Operations** | Working the transfer queue — the day-to-day of payments moving. |
| **Compliance** | KYC and investigations. The only role that can reveal a full bank account number, and every reveal is recorded with a reason. |
| **Administrator** | Staff accounts and roles. |

Nobody can change their own role, nobody can deactivate themselves, and the
system refuses to remove the last remaining administrator — that is how an
organisation locks itself out of its own back office.

---

## If an administrator loses access

**Forgotten password, mailbox still working:** use **Forgot password** on the
sign-in screen. A code is emailed. This is the one staff flow that does use
email, because at that point there may be nobody available to hand a code over.

**No access to the mailbox either:** another administrator cannot currently
re-issue a setup code — that is a known gap (backlog #32). Until it is built,
the recovery path is the `--force` flag on the bootstrap command, run by whoever
manages the deployment.

**Two-factor device lost:** the recovery codes shown once at enrolment. They are
meant to be printed or put in a password manager, not left on the phone that is
the thing most likely to be lost.
