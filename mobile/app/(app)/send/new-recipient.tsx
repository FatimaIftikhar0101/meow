/**
 * Adding a recipient, without leaving the send flow.
 *
 * The same screen as `/recipients/new`, mounted a second time inside the send
 * stack. It is not a copy: both routes render one component, so the form can
 * never drift between the two places it is reached from.
 *
 * Why a second route rather than a `from` parameter. `/recipients/new` lives in
 * the recipients tab, so pushing it from the send flow crossed navigators —
 * saving then called `router.back()`, which popped the *recipients* stack and
 * left someone who had been sending money standing in the People tab with
 * nothing selected. Returning them across tabs would have meant two chained
 * navigations at the exact point a recipient's account number was just
 * entered.
 *
 * Mounted here instead, the push and the pop happen in one stack and plain
 * `router.back()` — the call that was already there, and the only one this
 * screen makes — lands back on the picker. The picker reloads its recipients
 * on focus, so the new one is waiting.
 */
export { default } from '../recipients/new';
