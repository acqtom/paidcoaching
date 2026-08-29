import { CARDS } from "@/lib/cards";

export function NavigationTable() {
  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-200/60 dark:border-neutral-800 bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-900 shadow-lg shadow-neutral-300/40 dark:shadow-black/50">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-300/60 dark:border-neutral-700">
            <th className="px-5 py-3 font-semibold text-neutral-700 dark:text-neutral-300">
              Card
            </th>
            <th className="px-5 py-3 font-semibold text-neutral-700 dark:text-neutral-300">
              What it does
            </th>
            <th className="px-5 py-3 font-semibold text-neutral-700 dark:text-neutral-300">
              Destination
            </th>
          </tr>
        </thead>
        <tbody>
          {CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <tr
                key={card.slug}
                className="border-b border-neutral-300/40 last:border-0 dark:border-neutral-700/60"
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2 font-medium text-neutral-900 dark:text-neutral-100">
                    <Icon size={16} className="text-indigo-600 dark:text-indigo-400" />
                    {card.title}
                  </div>
                </td>
                <td className="px-5 py-3 text-neutral-500">{card.description}</td>
                <td className="px-5 py-3 font-mono text-xs text-neutral-500">
                  {card.href}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
