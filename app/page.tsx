"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// Inizializzazione del client Supabase (utilizza le variabili d'ambiente configurate)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

interface DayRecord {
  date: string;
  type: "lavorativo" | "festivo" | "ferie" | "riposo";
  note?: string;
  extra_pay?: number;
}

export default function ReteCorriereHome() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [daysData, setDaysData] = useState<Record<string, DayRecord>>({});
  const [basePay, setBasePay] = useState<number>(1450); // Valore di default o preso da DB
  const [loading, setLoading] = useState<boolean>(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-11

  // Caricamento dati da Supabase (Giornate e Paga Base dal contratto attivo)
  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      // 1. Carica il contratto attivo per la paga base
      const { data: contractData } = await supabase
        .from("contract_history")
        .select("base_pay")
        .is("end_date", null)
        .single();

      if (contractData && contractData.base_pay) {
        setBasePay(contractData.base_pay);
      }

      // 2. Carica i record dei giorni registrati
      const { data: records } = await supabase
        .from("days")
        .select("*");

      if (records) {
        const mapped: Record<string, DayRecord> = {};
        records.forEach((r: any) => {
          mapped[r.date] = r;
        });
        setDaysData(mapped);
      }

      setLoading(false);
    }

    fetchData();
  }, []);

  // Funzione per determinare lo stile e il colore del giorno (Festivi: Rosso, Ferie: Giallo)
  const getDayStyle = (type?: string) => {
    switch (type) {
      case "festivo":
        return "bg-red-100 text-red-700 border-red-300 font-semibold";
      case "ferie":
        return "bg-amber-100 text-amber-800 border-amber-300 font-semibold";
      case "riposo":
        return "bg-gray-100 text-gray-500 border-gray-200";
      case "lavorativo":
      default:
        return "bg-white text-gray-800 border-gray-200 hover:bg-blue-50";
    }
  };

  // Funzione per cambiare tipo di giorno al click (ciclo rapido)
  const handleDayClick = async (dateStr: string) => {
    const currentType = daysData[dateStr]?.type || "lavorativo";
    let nextType: DayRecord["type"] = "lavorativo";

    if (currentType === "lavorativo") nextType = "festivo";
    else if (currentType === "festivo") nextType = "ferie";
    else if (currentType === "ferie") nextType = "riposo";
    else nextType = "lavorativo";

    const updatedRecord: DayRecord = { date: dateStr, type: nextType };

    // Aggiorna stato locale
    setDaysData((prev) => ({ ...prev, [dateStr]: updatedRecord }));

    // Salva su Supabase (Upsert)
    await supabase.from("days").upsert([updatedRecord], { onConflict: "date" });
  };

  // Generazione giorni del mese corrente
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Domenica

  // Calcolo economico mensile stimato
  const totalExtra = Object.values(daysData).reduce((acc, curr) => acc + (curr.extra_pay || 0), 0);
  const estimatedTotal = basePay + totalExtra;

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header dell'applicazione */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Rete Corriere — Compensi</h1>
            <p className="text-sm text-gray-500">Poste Italiane | Monitoraggio Turni e Paga Base</p>
          </div>
          
          {/* Box Riepilogo Economico con Paga Base */}
          <div className="bg-blue-50 border border-blue-100 px-4 py-3 rounded-xl flex gap-6 items-center">
            <div>
              <span className="text-xs text-blue-600 font-medium block">Paga Base</span>
              <span className="text-lg font-bold text-blue-900">€ {basePay.toFixed(2)}</span>
            </div>
            <div className="border-l border-blue-200 pl-6">
              <span className="text-xs text-blue-600 font-medium block">Totale Stimato Mese</span>
              <span className="text-lg font-bold text-blue-900">€ {estimatedTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Controlli Calendario */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
          <button
            onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition"
          >
            ← Mese Precedente
          </button>
          
          <h2 className="text-lg font-semibold text-gray-800 capitalize">
            {currentDate.toLocaleString("it-IT", { month: "long", year: "numeric" })}
          </h2>

          <button
            onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition"
          >
            Mese Successivo →
          </button>
        </div>

        {/* Griglia Calendario */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="grid grid-cols-7 gap-2 mb-2 text-center font-semibold text-xs text-gray-400">
            <span>Dom</span><span>Lun</span><span>Mar</span><span>Mer</span><span>Gio</span><span>Ven</span><span>Sab</span>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {/* Spazi vuoti iniziali */}
            {Array.from({ length: (firstDayIndex + 6) % 7 }).map((_, index) => (
              <div key={`empty-${index}`} className="h-24 bg-gray-50/50 rounded-xl border border-transparent" />
            ))}

            {/* Giorni del mese */}
            {Array.from({ length: daysInMonth }).map((_, index) => {
              const dayNum = index + 1;
              const formattedMonth = String(month + 1).padStart(2, "0");
              const formattedDay = String(dayNum).padStart(2, "0");
              const dateStr = `${year}-${formattedMonth}-${formattedDay}`;
              
              const record = daysData[dateStr];
              const type = record?.type || "lavorativo";

              return (
                <div
                  key={dateStr}
                  onClick={() => handleDayClick(dateStr)}
                  className={`h-24 p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between select-none ${getDayStyle(type)}`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold">{dayNum}</span>
                    <span className="text-[10px] uppercase tracking-wider opacity-75 font-semibold">
                      {type === "festivo" ? "Festivo" : type === "ferie" ? "Ferie" : type === "riposo" ? "Riposo" : ""}
                    </span>
                  </div>
                  <div className="text-[11px] truncate">
                    {record?.extra_pay ? `+€${record.extra_pay}` : ""}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legenda Colori */}
          <div className="mt-6 flex flex-wrap gap-4 items-center justify-center text-xs text-gray-600 border-t pt-4">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-white border border-gray-300"></span> Lavorativo
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-100 border border-red-300"></span> Festivo (Rosso)
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-100 border border-amber-300"></span> Ferie (Giallo)
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-gray-100 border border-gray-200"></span> Riposo
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
