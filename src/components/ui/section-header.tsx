type SectionHeaderProps = {
  eyebrow: string;
  title: string;
  description?: string;
};

export function SectionHeader({
  eyebrow,
  title,
  description,
}: SectionHeaderProps) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-accent/80">
        {eyebrow}
      </p>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {description ? (
        <p className="max-w-sm text-sm leading-6 text-muted">{description}</p>
      ) : null}
    </div>
  );
}
