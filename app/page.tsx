"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// Inizializzazione diretta di Supabase (senza file esterni per evitare errori di percorso)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type DayType =
  | "WORK"
  | "ABBINAMENTO"
  | "STRAORDINARIO"
  | "ABBINAMENTO_STRAORDINARIO"
  | "FERIE"
  | "MALATTIA"
  | "PERMESSO"
  | "EX_FESTIVITA"
  | "LEGGE_104"
  | "INFORTUNIO"
  | "RIPOSO";

interface DayEntry {
  id?: string;
  date: string;
  type: DayType;
  partecipanti?: number;
  minutiStraordinario?: number;
  note?: string;
}

interface ContractPeriod {
  id: string;
  profile_id: string;
  data_inizio: string;
  livello: "E" | "D";
  giorni_settimanali: 5 | 6;
  ore_settimanali: number;
  paga_oraria_base: number;
  maggiorazione_straordinario: number;
  indennita_base: number;
  compensativa: number;
  quota_abbinamento: number;
  limite_abbinamenti: number;
}

const DAY_LABELS: Record<DayType, { label: string; color: string; worked: boolean }> = {
  WORK: { label: "Lavoro normale", color: "bg-emerald-100 text-emerald-800 border-emerald-300", worked: true },
  ABBINAMENTO: { label: "Abbinamento", color: "bg-blue-100 text-blue-800 border-blue-300", worked: true },
  STRAORDINARIO: { label: "Straordinario", color: "bg-amber-100 text-amber-800 border-amber-300", worked: true },
  ABBINAMENTO_STRAORDINARIO: { label: "Abb. + Straord.", color: "bg-purple-100 text-purple-800 border-purple-300", worked: true },
  FERIE: { label: "Ferie", color: "bg-sky-100 text-sky-800 border-sky-300", worked: false },
  MALATTIA: { label: "Malattia", color: "bg-red-100 text-red-800 border-red-300", worked: false },
  PERMESSO: { label: "Permesso", color: "bg-orange-100 text-orange-800 border-orange-300", worked: false },
  EX_FESTIVITA: { label: "Ex festività", color: "bg-teal-100 text-teal-800 border-teal-300", worked: false },
  LEGGE_104: { label: "Legge 104", color: "bg-indigo-100 text-indigo-800 border-indigo-300", worked: false },
  INFORTUNIO: { label: "Infortunio", color: "bg-rose-100 text-rose-800 border-rose-300", worked: false },
  RIPOSO: { label: "Riposo / Festivo", color: "bg-slate-100 text-slate-600 border-slate-300", worked: false },
};

const INDENNITA_DEFAULT: Record<string, number> = {
  E_6: 5.27,
  E_5: 6.32,
  D_6: 5.74,
  D_5: 6.89,
};

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [contracts, setContracts] = useState<ContractPeriod[]>([]);
  const [entries, setEntries] = useState<Record<string, DayEntry>>({});

  const [currentDate, setCurrentDate] = useState(new Date(2026, 10, 1)); // Novembre 2026
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showContractModal, setShowContractModal] = useState(false);

  // Form modale giorno
  const [formType, setFormType] = useState<DayType>("WORK");
  const [formPartecipanti, setFormPartecipanti] = useState<number>(2);
  const [formStraordinario, setFormStraordinario] = useState<number>(30);
  const [formNote, setFormNote] = useState<string>("");

  // Form nuovo periodo contrattuale
  const [newDataInizio, setNewDataInizio] = useState("2026-01-01");
  const [newLivello, setNewLivello] = useState<"E" | "D">("E");
  const [newGiorni, setNewGiorni] = useState<5 | 6>(6);
  const [newOreSett, setNewOreSett] = useState(39);
  const [newPagaOraria, setNewPagaOraria] = useState(11.5);
  const [newMaggiorazione, setNewMaggiorazione] = useState(15);
  const [newIndennitaBase, setNewIndennitaBase] = useState(5.27);
  const [newCompensativa, setNewCompensativa] = useState(4.0);
  const [newQuotaAbb, setNewQuotaAbb] = useState(46.0);
  const [newLimiteAbb, setNewLimiteAbb] = useState(16);

  useEffect(() => {
    async function initData() {
      try {
        // 1. Cerca profilo esistente o crealo
        let { data: profiles, error: profErr } = await supabase.from("profiles").select("*").limit(1);
        if (profErr) throw profErr;

        let activeProfile = profiles?.[0];
        if (!activeProfile) {
          const { data: created, error: createErr } = await supabase
            .from("profiles")
            .insert([{ nome: "Fabio" }])
            .select()
            .single();
          if (createErr) throw createErr;
          activeProfile = created;
        }
        setProfileId(activeProfile.id);

        // 2. Cerca storico contrattuale o crea lo scaglione iniziale
        let { data: contractList, error: contErr } = await supabase
          .from("contract_history")
          .select("*")
          .eq("profile_id", activeProfile.id)
          .order("data_inizio", { ascending: true });
        if (contErr) throw contErr;

        let activeContracts = contractList;
        if (!activeContracts || activeContracts.length === 0) {
          const { data: defaultContract, error: defErr } = await supabase
            .from("contract_history")
            .insert([
              {
                profile_id: activeProfile.id,
                data_inizio: "2026-01-01",
                livello: "E",
                giorni_settimanali: 6,
                ore_settimanali: 39,
                paga_oraria_base: 11.5,
                maggiorazione_straordinario: 15,
                indennita_base: 5.27,
                compensativa: 4.0,
                quota_abbinamento: 46.0,
                limite_abbinamenti: 16,
              },
            ])
            .select();
          if (defErr) throw defErr;
          activeContracts = defaultContract;
        }
        setContracts(activeContracts as ContractPeriod[]);

        // 3. Carica tutte le giornate salvate
        const { data: daysData, error: dayErr } = await supabase
          .from("days")
          .select("*")
          .eq("profile_id", activeProfile.id);
        if (dayErr) throw dayErr;

        const map: Record<string, DayEntry> = {};
        (daysData || []).forEach((d: any) => {
          map[d.data] = {
            id: d.id,
            date: d.data,
            type: d.tipo_giornata as DayType,
            partecipanti: d.partecipanti ?? undefined,
            minutiStraordinario: d.minuti_straordinario ?? undefined,
            note: d.note ?? "",
          };
        });
        setEntries(map);
      } catch (err: any) {
        console.error("Errore connessione Supabase:", err);
        alert("Errore Supabase: " + (err.message || JSON.stringify(err)));
      } finally {
        setLoading(false);
      }
    }

    initData();
  }, []);

  const getContractForDate = (isoDate: string): ContractPeriod => {
    const valid = contracts.filter((c) => c.data_inizio <= isoDate);
    if (valid.length > 0) return valid[valid.length - 1];
    return contracts[0] || {
      id: "default",
      profile_id: "",
      data_inizio: "2026-01-01",
      livello: "E",
      giorni_settimanali: 6,
      ore_settimanali: 39,
      paga_oraria_base: 11.5,
      maggiorazione_straordinario: 15,
      indennita_base: 5.27,
      compensativa: 4.0,
      quota_abbinamento: 46.0,
      limite_abbinamenti: 16,
    };
  };

  const calcolaCompetenzeGiorno = (entry: DayEntry) => {
    const contract = getContractForDate(entry.date);
    const meta = DAY_LABELS[entry.type];
    const indennitaGiorno = meta.worked ? Number(contract.indennita_base) + Number(contract.compensativa) : 0;

    const minutiTurno = (Number(contract.ore_settimanali) * 60) / Number(contract.giorni_settimanali);
    const tariffaStrOraria = Number(contract.paga_oraria_base) * (1 + Number(contract.maggiorazione_straordinario) / 100);

    let quotaAbbNetta = 0;
    let importoStraord = 0;

    const hasAbbinamento = entry.type === "ABBINAMENTO" || entry.type === "ABBINAMENTO_STRAORDINARIO";
    const hasStraordinario = entry.type === "STRAORDINARIO" || entry.type === "ABBINAMENTO_STRAORDINARIO";

    const minutiStr = hasStraordinario ? entry.minutiStraordinario || 0 : 0;
    if (minutiStr > 0) {
      importoStraord = (minutiStr / 60) * tariffaStrOraria;
    }

    if (hasAbbinamento) {
      const part = entry.partecipanti || 2;
      const quotaLorda = Number(contract.quota_abbinamento) / part;
      const minutiAssegnati = minutiTurno / part;

      if (minutiStr > 0) {
        const fattoreResiduo = Math.max(0, 1 - minutiStr / minutiAssegnati);
        quotaAbbNetta = quotaLorda * fattoreResiduo;
      } else {
        quotaAbbNetta = quotaLorda;
      }
    }

    return { quotaAbbNetta, importoStraord, indennitaGiorno };
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = currentDate.toLocaleDateString("it-IT", { month: "long", year: "numeric" });

  const monthIsoRef = `${year}-${String(month + 1).padStart(2, "0")}-15`;
  const activeMonthContract = getContractForDate(monthIsoRef);

  const monthDays = Array.from({ length: daysInMonth }, (_, i) => {
    const dayNum = i + 1;
    const dateObj = new Date(year, month, dayNum);
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    const isSunday = dateObj.getDay() === 0;
    const defaultType: DayType = isSunday ? "RIPOSO" : "WORK";
    const entry = entries[iso] || { date: iso, type: defaultType };
    return { dayNum, dateObj, iso, entry };
  });

  let giorniLavorati = 0;
  let totaleIndennita = 0;
  let totaleAbbinamenti = 0;
  let importoAbbinamentiTotali = 0;
  let minutiStraordinarioTotali = 0;
  let importoStraordinarioTotale = 0;
  let ferieCount = 0;
  let malattiaCount = 0;

  monthDays.forEach(({ entry }) => {
    const meta = DAY_LABELS[entry.type];
    if (meta.worked) giorniLavorati++;
    if (entry.type === "FERIE") ferieCount++;
    if (entry.type === "MALATTIA") malattiaCount++;

    if (entry.type === "ABBINAMENTO" || entry.type === "ABBINAMENTO_STRAORDINARIO") {
      totaleAbbinamenti++;
    }
    if (entry.type === "STRAORDINARIO" || entry.type === "ABBINAMENTO_STRAORDINARIO") {
      minutiStraordinarioTotali += entry.minutiStraordinario || 0;
    }

    const { quotaAbbNetta, importoStraord, indennitaGiorno } = calcolaCompetenzeGiorno(entry);
    totaleIndennita += indennitaGiorno;
    importoAbbinamentiTotali += quotaAbbNetta;
    importoStraordinarioTotale += importoStraord;
  });

  const limiteMensile = activeMonthContract?.limite_abbinamenti ?? 16;
  const residuoAbbinamenti = Math.max(0, limiteMensile - totaleAbbinamenti);
  const totaleStimato = totaleIndennita + importoAbbinamentiTotali + importoStraordinarioTotale;

  const openDayModal = (iso: string, currentEntry: DayEntry) => {
    setSelectedDate(iso);
    setFormType(currentEntry.type);
    setFormPartecipanti(currentEntry.partecipanti || 2);
    setFormStraordinario(currentEntry.minutiStraordinario || 30);
    setFormNote(currentEntry.note || "");
  };

  const handleSaveDay = async () => {
    if (!selectedDate || !profileId) return;
    setSaving(true);
    try {
      const payload = {
        profile_id: profileId,
        data: selectedDate,
        tipo_giornata: formType,
        partecipanti: formType === "ABBINAMENTO" || formType === "ABBINAMENTO_STRAORDINARIO" ? formPartecipanti : null,
        minuti_straordinario: formType === "STRAORDINARIO" || formType === "ABBINAMENTO_STRAORDINARIO" ? formStraordinario : null,
        note: formNote || null,
      };

      const { data, error } = await supabase
        .from("days")
        .upsert(payload, { onConflict: "profile_id,data" })
        .select()
        .single();

      if (error) throw error;

      setEntries((prev) => ({
        ...prev,
        [selectedDate]: {
          id: data.id,
          date: selectedDate,
          type: formType,
          partecipanti: payload.partecipanti ?? undefined,
          minutiStraordinario: payload.minuti_straordinario ?? undefined,
          note: formNote,
        },
      }));
      setSelectedDate(null);
    } catch (err: any) {
      console.error("Errore salvataggio giorno:", err);
      alert("Errore salvataggio: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddContractPeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("contract_history").insert([
        {
          profile_id: profileId,
          data_inizio: newDataInizio,
          livello: newLivello,
          giorni_settimanali: newGiorni,
          ore_settimanali: newOreSett,
          paga_oraria_base: newPagaOraria,
          maggiorazione_straordinario: newMaggiorazione,
          indennita_base: newIndennitaBase,
          compensativa: newCompensativa,
          quota_abbinamento: newQuotaAbb,
          limite_abbinamenti: newLimiteAbb,
        },
      ]);
      if (error) throw error;
      window.location.reload();
    } catch (err: any) {
      console.error("Errore inserimento contratto:", err);
      alert("Errore contratto: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteContract = async (id: string) => {
    if (contracts.length <= 1) {
      alert("Deve rimanere almeno un periodo contrattuale attivo.");
      return;
    }
    await supabase.from("contract_history").delete().eq("id", id);
    window.location.reload();
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600">
        <p className="text-sm font-medium animate-pulse">Connessione al database Supabase in corso...</p>
      </main>
    );
  }

  const previewCalcolo = calcolaCompetenzeGiorno({
    date: selectedDate || monthIsoRef,
    type: formType,
    partecipanti: formPartecipanti,
    minutiStraordinario: formStraordinario,
  });

  const selectedDayContract = selectedDate ? getContractForDate(selectedDate) : activeMonthContract;
  const minutiTurnoSelected = selectedDayContract
    ? (Number(selectedDayContract.ore_settimanali) * 60) / Number(selectedDayContract.giorni_settimanali)
    : 390;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between bg-white p-5 rounded-2xl shadow-sm border border-slate-200 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">Rete Corriere — Competenze</h1>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                Cloud Sync ✓
              </span>
            </div>
            {activeMonthContract && (
              <p className="text-sm text-slate-500 mt-1">
                Contratto nel mese:{" "}
                <span className="font-semibold text-slate-700">
                  Livello {activeMonthContract.livello} · {activeMonthContract.giorni_settimanali} gg
                </span>{" "}
                ({(Number(activeMonthContract.indennita_base) + Number(activeMonthContract.compensativa)).toFixed(2)} €/gg) · Paga base:{" "}
                <span className="font-semibold text-slate-700">
                  {Number(activeMonthContract.paga_oraria_base).toFixed(2)} €/h
                </span>{" "}
                (+{activeMonthContract.maggiorazione_straordinario}%)
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                if (activeMonthContract) {
                  setNewLivello(activeMonthContract.livello);
                  setNewGiorni(activeMonthContract.giorni_settimanali);
                  setNewPagaOraria(Number(activeMonthContract.paga_oraria_base));
                  setNewIndennitaBase(Number(activeMonthContract.indennita_base));
                  setNewCompensativa(Number(activeMonthContract.compensativa));
                  setNewQuotaAbb(Number(activeMonthContract.quota_abbinamento));
                  setNewLimiteAbb(activeMonthContract.limite_abbinamenti);
                }
                setShowContractModal(true);
              }}
              className="px-3.5 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-sm font-medium"
            >
              ⚙ Storico Contratto & Parametri
            </button>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-sm font-medium"
              >
                ←
              </button>
              <span className="px-2 py-1.5 font-semibold capitalize min-w-[140px] text-center text-sm">
                {monthName}
              </span>
              <button
                onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-sm font-medium"
              >
                →
              </button>
            </div>
          </div>
        </header>

        {/* Dashboard Riepilogo */}
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Lavorati</p>
            <p className="text-2xl font-bold mt-1">
              {giorniLavorati} <span className="text-sm font-normal text-slate-400">gg</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Indennità: <span className="font-semibold text-slate-700">{totaleIndennita.toFixed(2)} €</span>
            </p>
          </div>

          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Abbinamenti</p>
            <p className="text-2xl font-bold mt-1 text-blue-600">
              {totaleAbbinamenti} <span className="text-base font-normal text-slate-400">/ {limiteMensile}</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Residui: <span className="font-semibold">{residuoAbbinamenti}</span> · Netti:{" "}
              <span className="font-semibold text-blue-700">{importoAbbinamentiTotali.toFixed(2)} €</span>
            </p>
          </div>

          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
              Straordinari (+{activeMonthContract?.maggiorazione_straordinario ?? 15}%)
            </p>
            <p className="text-2xl font-bold mt-1 text-amber-600">{importoStraordinarioTotale.toFixed(2)} €</p>
            <p className="text-xs text-slate-500 mt-1">
              Totale: <span className="font-semibold">{minutiStraordinarioTotali} min</span> (
              {(minutiStraordinarioTotali / 60).toFixed(2)} h)
            </p>
          </div>

          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Assenze Mese</p>
            <p className="text-lg font-bold mt-1">Ferie: {ferieCount}</p>
            <p className="text-xs text-slate-500 mt-1">Malattia: {malattiaCount}</p>
          </div>

          <div className="col-span-2 lg:col-span-1 bg-emerald-600 text-white p-4 rounded-2xl shadow-sm">
            <p className="text-xs uppercase tracking-wider text-emerald-100 font-semibold">Totale Busta Stimato</p>
            <p className="text-2xl font-extrabold mt-1">{totaleStimato.toFixed(2)} €</p>
            <p className="text-[11px] text-emerald-100 mt-1">Indennità + Abb. + Straord.</p>
          </div>
        </section>

        {/* Calendario Mensile */}
        <section className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Calendario Giornaliero</h2>
            <span className="text-xs text-slate-500">Clicca su un giorno per registrare variazioni</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
            {monthDays.map(({ dayNum, dateObj, iso, entry }) => {
              const meta = DAY_LABELS[entry.type];
              const weekday = dateObj.toLocaleDateString("it-IT", { weekday: "short" });
              const { quotaAbbNetta, importoStraord } = calcolaCompetenzeGiorno(entry);

              return (
                <button
                  key={iso}
                  onClick={() => openDayModal(iso, entry)}
                  className={`text-left p-3 rounded-xl border transition hover:shadow-md flex flex-col justify-between min-h-[104px] ${meta.color}`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="font-bold text-base">{dayNum}</span>
                    <span className="text-xs uppercase opacity-75">{weekday}</span>
                  </div>

                  <div className="mt-2 space-y-0.5">
                    <p className="text-xs font-semibold leading-tight">{meta.label}</p>
                    {(entry.type === "ABBINAMENTO" || entry.type === "ABBINAMENTO_STRAORDINARIO") &&
                      entry.partecipanti && (
                        <p className="text-[11px] font-bold">
                          1/{entry.partecipanti} → {quotaAbbNetta.toFixed(2)} €
                        </p>
                      )}
                    {entry.minutiStraordinario ? (
                      <p className="text-[11px] font-medium">
                        +{entry.minutiStraordinario}m ({importoStraord.toFixed(2)} €)
                      </p>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* Modale Modifica Giorno */}
      {selectedDate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold">Modifica giorno: {selectedDate}</h3>
              <button onClick={() => setSelectedDate(null)} className="text-slate-400 hover:text-slate-700 text-xl">
                ✕
              </button>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5">Tipo giornata</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as DayType)}
                className="w-full border border-slate-300 rounded-xl p-2.5 text-sm bg-white"
              >
                {Object.entries(DAY_LABELS).map(([key, val]) => (
                  <option key={key} value={key}>
                    {val.label}
                  </option>
                ))}
              </select>
            </div>

            {(formType === "ABBINAMENTO" || formType === "ABBINAMENTO_STRAORDINARIO") && (
              <div>
                <label className="block text-sm font-semibold mb-1.5">Numero partecipanti abbinamento</label>
                <div className="grid grid-cols-5 gap-2 mb-2">
                  {[2, 3, 4, 5, 6].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setFormPartecipanti(num)}
                      className={`py-2 rounded-lg border text-sm font-bold ${
                        formPartecipanti === num
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-slate-50 border-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-600">
                  Frazione turno collega: <span className="font-semibold">{(minutiTurnoSelected / formPartecipanti).toFixed(0)} min</span> · Quota lorda:{" "}
                  <span className="font-semibold">
                    {((selectedDayContract?.quota_abbinamento ?? 46) / formPartecipanti).toFixed(2)} €
                  </span>
                </p>
              </div>
            )}

            {(formType === "STRAORDINARIO" || formType === "ABBINAMENTO_STRAORDINARIO") && (
              <div>
                <label className="block text-sm font-semibold mb-1.5">
                  Minuti di straordinario (diurno +{selectedDayContract?.maggiorazione_straordinario ?? 15}%)
                </label>
                <div className="grid grid-cols-5 gap-2 mb-2">
                  {[15, 30, 45, 60, 90].map((min) => (
                    <button
                      key={min}
                      type="button"
                      onClick={() => setFormStraordinario(min)}
                      className={`py-2 rounded-lg border text-sm font-bold ${
                        formStraordinario === min
                          ? "bg-amber-600 text-white border-amber-600"
                          : "bg-slate-50 border-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      {min}m
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={formStraordinario}
                  onChange={(e) => setFormStraordinario(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-xl p-2 text-sm"
                  placeholder="Oppure inserisci minuti liberi"
                />
              </div>
            )}

            {(formType === "ABBINAMENTO" || formType === "STRAORDINARIO" || formType === "ABBINAMENTO_STRAORDINARIO") && (
              <div className="bg-slate-100 p-3 rounded-xl text-xs space-y-1 border border-slate-200">
                <p className="font-bold text-slate-700">Riepilogo economico giornata:</p>
                {(formType === "ABBINAMENTO" || formType === "ABBINAMENTO_STRAORDINARIO") && (
                  <p>
                    Quota abbinamento {formType === "ABBINAMENTO_STRAORDINARIO" ? "(dopo erosione)" : ""}:{" "}
                    <span className="font-bold text-blue-700">{previewCalcolo.quotaAbbNetta.toFixed(2)} €</span>
                  </p>
                )}
                {(formType === "STRAORDINARIO" || formType === "ABBINAMENTO_STRAORDINARIO") && (
                  <p>
                    Compenso straordinario ({formStraordinario} min):{" "}
                    <span className="font-bold text-amber-700">{previewCalcolo.importoStraord.toFixed(2)} €</span>
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold mb-1">Note (opzionale)</label>
              <input
                type="text"
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                className="w-full border border-slate-300 rounded-xl p-2 text-sm"
                placeholder="Es. Zona centro, affiancamento..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedDate(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-medium hover:bg-slate-50"
              >
                Annulla
              </button>
              <button
                disabled={saving}
                onClick={handleSaveDay}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? "Salvataggio..." : "Salva su Cloud"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale Storico Contrattuale & Parametri */}
      {showContractModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold">Storico Contrattuale & Parametri Economici</h3>
              <button onClick={() => setShowContractModal(false)} className="text-slate-400 hover:text-slate-700 text-xl">
                ✕
              </button>
            </div>

            <div>
              <h4 className="text-xs uppercase font-bold text-slate-500 mb-2">Periodi registrati nel database</h4>
              <div className="space-y-2">
                {contracts.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs gap-2"
                  >
                    <div>
                      <span className="font-bold text-slate-900">Dal {c.data_inizio}</span> · Livello{" "}
                      <span className="font-bold">{c.livello}</span> ({c.giorni_settimanali} gg) · Indennità:{" "}
                      <span className="font-semibold">
                        {Number(c.indennita_base).toFixed(2)} + {Number(c.compensativa).toFixed(2)} €
                      </span>{" "}
                      · Paga base: <span className="font-semibold">{Number(c.paga_oraria_base).toFixed(2)} €/h</span>
                    </div>
                    {contracts.length > 1 && (
                      <button
                        onClick={() => handleDeleteContract(c.id)}
                        className="text-red-600 hover:underline font-semibold"
                      >
                        Elimina
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleAddContractPeriod} className="border-t pt-4 space-y-3">
              <h4 className="text-sm font-bold text-slate-800">Aggiungi nuovo periodo / variazione contrattuale</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Data decorrenza</label>
                  <input
                    type="date"
                    required
                    value={newDataInizio}
                    onChange={(e) => setNewDataInizio(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Livello</label>
                  <select
                    value={newLivello}
                    onChange={(e) => {
                      const liv = e.target.value as "E" | "D";
                      setNewLivello(liv);
                      setNewIndennitaBase(INDENNITA_DEFAULT[`${liv}_${newGiorni}`]);
                    }}
                    className="w-full border border-slate-300 rounded-xl p-2 text-sm bg-white"
                  >
                    <option value="E">Livello E</option>
                    <option value="D">Livello D</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Giorni settimanali</label>
                  <select
                    value={newGiorni}
                    onChange={(e) => {
                      const gg = Number(e.target.value) as 5 | 6;
                      setNewGiorni(gg);
                      setNewIndennitaBase(INDENNITA_DEFAULT[`${newLivello}_${gg}`]);
                    }}
                    className="w-full border border-slate-300 rounded-xl p-2 text-sm bg-white"
                  >
                    <option value={6}>6 giorni (390 min)</option>
                    <option value={5}>5 giorni (468 min)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Paga Oraria Base (€/h)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newPagaOraria}
                    onChange={(e) => setNewPagaOraria(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-xl p-2 text-sm font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Indennità Base (€/gg)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newIndennitaBase}
                    onChange={(e) => setNewIndennitaBase(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-xl p-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Compensativa (€/gg)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newCompensativa}
                    onChange={(e) => setNewCompensativa(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-xl p-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Quota Abbinamento (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newQuotaAbb}
                    onChange={(e) => setNewQuotaAbb(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-xl p-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Plafond Abbinamenti</label>
                  <input
                    type="number"
                    required
                    value={newLimiteAbb}
                    onChange={(e) => setNewLimiteAbb(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-xl p-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Magg. Straord. (%)</label>
                  <input
                    type="number"
                    required
                    value={newMaggiorazione}
                    onChange={(e) => setNewMaggiorazione(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-xl p-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowContractModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-medium hover:bg-slate-50"
                >
                  Chiudi
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving ? "Salvataggio..." : "+ Salva nuova decorrenza"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
