interface InputProps {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
}

export function Input({
  id,
  label,
  type = 'text',
  value,
  onChange,
  error,
  placeholder,
  autoComplete,
  required,
}: InputProps) {
  const baseClasses =
    'w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 sm:text-sm';
  const normalClasses = 'border-gray-300 focus:ring-teal-500 focus:border-teal-500';
  const errorClasses = 'border-red-500 focus:ring-red-500 focus:border-red-500';

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className={`${baseClasses} ${error ? errorClasses : normalClasses}`}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
