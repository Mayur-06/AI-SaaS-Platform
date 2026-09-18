import React from 'react';

/**
 * Input Component
 */
export const Input = ({
  label,
  error,
  helperText,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-semibold text-[#292929] uppercase tracking-wider font-mono"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full px-3.5 py-2.5 border rounded-xl text-sm bg-white text-[#292929] placeholder-gray-400
                   transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#b2c147] focus:border-transparent
                   disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
                   read-only:bg-gray-50/80 read-only:cursor-default
                   ${
                     error
                       ? 'border-red-300 focus:ring-red-400'
                       : 'border-gray-200 hover:border-gray-300'
                   } ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
      {!error && helperText && (
        <p className="text-xs text-gray-500">{helperText}</p>
      )}
    </div>
  );
};
