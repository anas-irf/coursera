/** A class name, or nothing (``false``, ``null``, ``undefined``, ``''``) when a condition is not met. */
export type ClassValue = string | false | null | undefined;

/** Joins the class names that are set: ``cn('a', done && 'b', null)`` is ``'a b'`` or ``'a'``. */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(' ');
}

export default cn;
