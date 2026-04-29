import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-white group-[.toaster]:text-gray-100 group-[.toaster]:border-gray-20 group-[.toaster]:shadow-lg rounded-none',
          description: 'group-[.toast]:text-gray-60',
          actionButton:
            'group-[.toast]:bg-brand group-[.toast]:text-white rounded-none',
          cancelButton:
            'group-[.toast]:bg-gray-20 group-[.toast]:text-gray-100 rounded-none',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
