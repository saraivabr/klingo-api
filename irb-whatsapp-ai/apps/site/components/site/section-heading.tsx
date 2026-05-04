type SectionHeadingProps = {
  kicker: string;
  title: string;
  text: string;
};

export function SectionHeading({ kicker, title, text }: SectionHeadingProps) {
  return (
    <div className="section-heading">
      <p className="section-kicker">{kicker}</p>
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}
