import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Combines and merges CSS class names intelligently.
 *
 * This utility function combines multiple class names and resolves conflicts
 * between Tailwind CSS classes. It's the recommended way to handle dynamic
 * className combinations in React components.
 *
 * @param inputs - Any number of class values (strings, objects, arrays, or conditional values)
 * @returns A single merged className string with conflicts resolved
 *
 * @example
 * // Simple class combination
 * cn('px-4', 'py-2', 'bg-blue-500')
 * // => 'px-4 py-2 bg-blue-500'
 *
 * @example
 * // Conditional classes (falsy values are ignored)
 * cn('text-base', isActive && 'font-bold', isError && 'text-red-500')
 * // => 'text-base font-bold' (if isActive=true, isError=false)
 *
 * @example
 * // Conflicting Tailwind classes (later values override earlier ones)
 * cn('px-2 py-1', 'px-4')
 * // => 'py-1 px-4' (px-2 is overridden by px-4)
 *
 * @example
 * // Object syntax for conditional classes
 * cn({
 *   'text-blue-500': isPrimary,
 *   'text-red-500': isError,
 *   'font-bold': isImportant
 * })
 *
 * @example
 * // Common usage in components with base + variant classes
 * const Button = ({ className, variant }: Props) => (
 *   <button className={cn(
 *     'px-4 py-2 rounded', // base classes
 *     variant === 'primary' && 'bg-blue-500 text-white',
 *     variant === 'secondary' && 'bg-gray-200 text-gray-900',
 *     className // allow prop overrides
 *   )}>
 *     Click me
 *   </button>
 * )
 *
 * @remarks
 * This function combines two powerful utilities:
 * - `clsx`: Handles conditional class names and various input formats
 * - `twMerge`: Intelligently merges Tailwind classes, resolving conflicts
 *
 * The order matters: later classes will override earlier conflicting classes.
 * For example, cn('text-sm', 'text-lg') will result in 'text-lg'.
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}
