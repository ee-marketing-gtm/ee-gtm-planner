export function StarLogo({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M50 8 C52 8 55 22 61 35 Q63 39 67 39 C78 38 92 37 93 39 C94 41 83 48 70 57 Q67 60 68 64 C72 77 79 91 77 92 C75 93 64 83 53 75 Q50 73 47 75 C36 83 25 93 23 92 C21 91 28 77 32 64 Q33 60 30 57 C17 48 6 41 7 39 C8 37 22 38 33 39 Q37 39 39 35 C45 22 48 8 50 8Z"
        fill="#3538CD"
      />
    </svg>
  );
}
