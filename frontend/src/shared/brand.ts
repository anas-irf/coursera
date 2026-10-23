// What the product is called, in one place: the logo, the page titles, the login page and the
// footer read it from here.  It is a portfolio clone, and says so.

export const BRAND = {
  /** The full name: titles and the login page. */
  name: 'Coursera Clone',
  /** The word of the logo. */
  wordmark: 'Coursera',
  /** The small tag next to the word. */
  tag: 'clone',
  /** The paid membership. */
  plus: 'Coursera Plus',
  /** Said wherever the name is shown to a visitor who may not know the context. */
  disclaimer: 'A portfolio project. Not affiliated with Coursera Inc.',
} as const;

export default BRAND;
