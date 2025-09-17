Manual Accessibility Checklist for SACHDEVA OPTICALS

Run these checks in a browser (Chrome/Edge/Firefox) and with a screen reader where possible.

1) Keyboard navigation
 - Tab through the header and ensure Skip link focuses the product gallery link.
 - Open the mobile menu (narrow viewport) and navigate with Tab; ensure menu close button is reachable.
 - Open a product quick view; focus should move into the modal and Tab should cycle within it. Escape should close the modal.
 - Use arrow keys to navigate gallery thumbnails when focused; Enter/Space should switch the main image.

2) Screen reader announcements
 - Add an item to the cart and confirm the live region (#a11y-live) announces "<product> added to cart.".
 - Update quantity in the cart; the quantity elements use aria-live and should announce changes.

3) Contrast & text
 - Hero CTAs and cart badge should have sufficient contrast vs background.
 - Verify headings and body text are readable at 100% zoom.

4) Forms
 - Contact form inputs must have visible labels; ensure label associations (for/id) read correctly in a screen reader.
 - Checkout drawer inputs are keyboard-accessible and have a logical tab order.

5) Images & alt text
 - Product images must have descriptive alt text where possible. Thumbnails have alt attributes.

6) Mobile and responsive
 - Reduce viewport width to 360px and test the mobile nav, quick view, and cart.
 - Ensure focus management works when opening/closing overlays.

7) Additional checks (optional)
 - Run pa11y locally: npm run a11y (requires pa11y installed via devDependencies).
 - Run the E2E smoke test: npm run test:e2e (starts server and runs a small flow).

If you want, I can convert this checklist into a Git-tracked file and commit it for you; say "Please add checklist to repo" and I'll create and stage it.