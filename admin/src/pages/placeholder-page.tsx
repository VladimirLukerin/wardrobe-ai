export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="stack-lg">
      <h1 className="page-title">{title}</h1>
      <div className="panel">
        <p className="page-subtitle">Раздел в разработке. Данные появятся в следующих фазах admin panel.</p>
      </div>
    </div>
  );
}
