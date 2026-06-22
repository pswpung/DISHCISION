"use client";

import React, { useState, useEffect } from 'react';
import { ThemeToggle } from '../components/theme-toggle/theme-toggle';

interface Preference {
  price: string;
  category: string[];
  avoid_categories: string[];
  good_fors: string[];
  parking: boolean;
  alcohols: boolean;
  priorities: string[][]; // Support list of lists for advanced ranking
  lat: number;
  lng: number;
  max_walk_distance: number;
  preferred_restaurant: any[];
  meal_time: string;
}

interface Attendee {
  user_id: string;
  name: string;
  is_key_person: boolean;
  preference: Preference;
}

interface RestaurantInput {
  name: string;
  price: string;
  category: string[];
  good_fors: string[];
  parking: string;
  alcohols: string[];
  lat: number;
  lng: number;
  rating: number;
}

interface CalculationResult {
  final_score: number;
  dynamic_weights: Record<string, number>;
  reason_breakdown: Record<string, {
    key_ratio: number;
    attendee_ratio: number;
    weighted_score: number;
    max_score: number;
    base_score: number;
  }>;
  summaries: {
    key: any;
    general: any;
  };
  individual_results?: Array<{
    user_id: string;
    score: number;
    breakdown: Record<string, { score: number; max: number }>;
  }>;
}

export default function PlaygroundPage() {
  const [config, setConfig] = useState<any>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [keyPersonRatio, setKeyPersonRatio] = useState<number>(70);

  const [restaurant, setRestaurant] = useState<RestaurantInput>({
    name: "",
    price: "",
    category: [],
    good_fors: [],
    parking: "ไม่มีที่จอดรถ",
    alcohols: [],
    lat: 13.7563,
    lng: 100.5018,
    rating: 0
  });

  const [result, setResult] = useState<CalculationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Search state per attendee for adding preferred restaurants
  const [attendeeSearchTerms, setAttendeeSearchTerms] = useState<Record<string, string>>({});
  const [attendeeSearchResults, setAttendeeSearchResults] = useState<Record<string, any[]>>({});

  useEffect(() => {
    fetch('http://localhost:8081/restaurant/config')
      .then(res => res.json())
      .then(data => {
        setConfig(data);
        if (data && data.price && data.price.length > 0) {
          setRestaurant(r => ({ ...r, price: data.price[0] }));
        }
      })
      .catch(err => console.error("Failed to fetch config", err));
  }, []);

  useEffect(() => {
    if (searchTerm.length > 1) {
      fetch(`http://localhost:8081/restaurant/search?keyword=${encodeURIComponent(searchTerm)}`)
        .then(res => res.json())
        .then(data => setSearchResults(data))
        .catch(err => console.error("Search failed", err));
    } else {
      setSearchResults([]);
    }
  }, [searchTerm]);

  const searchAttendeeRestaurant = async (userId: string, keyword: string) => {
    setAttendeeSearchTerms(prev => ({ ...prev, [userId]: keyword }));
    if (keyword.trim().length > 1) {
      try {
        const res = await fetch(`http://localhost:8081/restaurant/search?keyword=${encodeURIComponent(keyword)}`);
        const data = await res.json();
        setAttendeeSearchResults(prev => ({ ...prev, [userId]: data }));
      } catch (err) {
        console.error("Attendee search failed", err);
      }
    } else {
      setAttendeeSearchResults(prev => ({ ...prev, [userId]: [] }));
    }
  };

  const selectRestaurantForTest = (res: any) => {
    const parseList = (val: any) => {
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') {
        try {
          return JSON.parse(val.replace(/'/g, '"'));
        } catch (e) {
          return [val];
        }
      }
      return [];
    };

    setRestaurant({
      name: res.name || "Unknown",
      price: res.price || res.price_point || config?.price[0] || "101 - 250 บาท",
      category: parseList(res.category),
      good_fors: parseList(res.good_fors),
      parking: res.parking || "ไม่มีที่จอดรถ",
      alcohols: parseList(res.alcohols),
      lat: res.lat || 13.7563,
      lng: res.lng || 100.5018,
      rating: res.rating || 0
    });
    setSearchTerm("");
    setSearchResults([]);
  };

  const calculateScore = async () => {
    if (attendees.length === 0) {
      alert("Please add at least one attendee.");
      return;
    }

    setLoading(true);
    setResult(null);

    const payload = {
      attendees: attendees.map(a => ({
        user_id: a.user_id,
        is_key_person: a.is_key_person,
        preference: {
          ...a.preference,
          // Match backend formatting for priorities
          priorities: a.preference.priorities
        }
      })),
      restaurant: {
        ...restaurant,
        category: restaurant.category,
        good_fors: restaurant.good_fors,
        alcohols: restaurant.alcohols
      },
      key_weight: attendees.some(a => a.is_key_person) ? keyPersonRatio / 100.0 : 0.7
    };

    try {
      const response = await fetch('http://localhost:8081/playground/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        const detail = typeof errorData.detail === 'object' ? JSON.stringify(errorData.detail) : errorData.detail;
        throw new Error(detail || "Calculation failed");
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      console.error("Calculation failed", err);
      let msg = err.message;
      try {
        const parsed = JSON.parse(msg);
        if (Array.isArray(parsed)) {
          msg = parsed.map((e: any) => `${e.loc.join('.')}: ${e.msg}`).join('\n');
        }
      } catch (e) { }
      alert(`Error:\n${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const addAttendee = () => {
    const newId = `user_${attendees.length + 1}`;
    setAttendees([...attendees, {
      user_id: newId,
      name: `Guest ${attendees.length + 1}`,
      is_key_person: false,
      preference: {
        price: config?.price[0] || "101 - 250 บาท",
        category: [],
        avoid_categories: [],
        good_fors: [],
        parking: false,
        alcohols: false,
        priorities: [["Price"], ["Category"], ["Vibe"]], // Initial focus factors sequence
        lat: 13.7563,
        lng: 100.5018,
        max_walk_distance: 1000,
        preferred_restaurant: [],
        meal_time: "Any"
      }
    }]);
  };

  const updateAttendee = (index: number, updates: Partial<Attendee>) => {
    const newAttendees = [...attendees];
    newAttendees[index] = { ...newAttendees[index], ...updates };
    setAttendees(newAttendees);
  };

  const updateAttendeePreference = (index: number, updates: Partial<Preference>) => {
    const newAttendees = [...attendees];
    newAttendees[index].preference = { ...newAttendees[index].preference, ...updates };
    setAttendees(newAttendees);
  };

  const removeAttendee = (index: number) => {
    const newAttendees = attendees.filter((_, i) => i !== index);
    setAttendees(newAttendees);
  };

  const toggleAttendeePriority = (idx: number, factor: string) => {
    const currentPriorities = attendees[idx].preference.priorities || [];
    // Flatten check
    const flat = currentPriorities.flat();
    const isSelected = flat.includes(factor);

    let nextPriorities: string[][];
    if (isSelected) {
      // Remove it
      nextPriorities = currentPriorities
        .map(group => group.filter(f => f !== factor))
        .filter(group => group.length > 0);
    } else {
      // Add it as a new group at the end
      nextPriorities = [...currentPriorities, [factor]];
    }

    updateAttendeePreference(idx, { priorities: nextPriorities });
  };

  const getRankLabel = (priorities: string[][], factor: string): string => {
    const index = priorities.findIndex(group => group.includes(factor));
    if (index === -1) return "";
    const suffixes = ["st", "nd", "rd"];
    const v = index + 1;
    if (v >= 11 && v <= 13) return `${v}th`;
    const lastDigit = v % 10;
    const suffix = suffixes[lastDigit - 1] || "th";
    return `${v}${suffix}`;
  };

  const priorityFactors = ['Price', 'Category', 'Vibe', 'Station', 'Rating', 'Parking', 'Alcohol'];

  return (
    <div className="min-h-screen p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent italic tracking-tight">
            DISHCISION PLAYGROUND
          </h1>
          <p className="text-muted-foreground text-sm">Experiment and simulate scoring variables interactively</p>
        </div>
        <div className="flex gap-2.5">
          <button
            onClick={addAttendee}
            className="glass-button px-6 py-2.5 rounded-full font-bold flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <span>+ Add Attendee</span>
          </button>
          <button
            onClick={calculateScore}
            disabled={loading}
            className="glass-button px-8 py-2.5 rounded-full font-bold bg-white text-black hover:bg-opacity-90 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            {loading ? "Calculating..." : "Calculate Score"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Attendees */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              👥 Attendees ({attendees.length})
            </h2>

            {/* Decision weight ratio slider */}
            {attendees.some(a => a.is_key_person) && (
              <div className="glass-panel p-4 rounded-xl border border-white/5 space-y-3 animate-in fade-in duration-300">
                <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider">
                  <span className="text-amber-500">Key Decision Makers: {keyPersonRatio}%</span>
                  <span className="text-primary">General Attendees: {100 - keyPersonRatio}%</span>
                </div>
                
                <div className="relative w-full h-3 bg-white/10 rounded-full overflow-hidden flex">
                  <div 
                    className="h-full bg-amber-500 transition-all duration-300"
                    style={{ width: `${keyPersonRatio}%` }}
                  />
                  <div 
                    className="h-full bg-primary/70 transition-all duration-300"
                    style={{ width: `${100 - keyPersonRatio}%` }}
                  />
                </div>

                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="70"
                    max="90"
                    step="5"
                    value={keyPersonRatio}
                    onChange={(e) => setKeyPersonRatio(parseInt(e.target.value))}
                    className="flex-1 h-1.5 rounded-lg appearance-none cursor-pointer bg-white/10 accent-amber-500 focus:outline-none"
                    style={{
                      background: `linear-gradient(to right, rgb(245, 158, 11) 0%, rgb(245, 158, 11) ${((keyPersonRatio - 70) / 20) * 100}%, rgba(255, 255, 255, 0.1) ${((keyPersonRatio - 70) / 20) * 100}%, rgba(255, 255, 255, 0.1) 100%)`
                    }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
                  Adjust KPs decision priority. Key person weight must be between 70% and 90%.
                </p>
              </div>
            )}
          </div>

          {attendees.length === 0 ? (
            <div className="text-center py-20 glass-panel rounded-2xl border border-dashed border-white/10 text-muted-foreground">
              <span className="text-4xl block mb-3">👥</span>
              <p className="font-bold">No Attendees Yet</p>
              <p className="text-xs mt-1">Click "+ Add Attendee" to simulate attendee preference inputs.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {attendees.map((attendee, idx) => (
                <div key={attendee.user_id} className="glass-panel p-6 rounded-2xl space-y-6 relative group">
                  <button
                    onClick={() => removeAttendee(idx)}
                    className="absolute top-4 right-4 text-muted-foreground hover:text-destructive transition-colors text-lg"
                  >
                    ✕
                  </button>

                  {/* Header / Name */}
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${attendee.is_key_person ? 'bg-amber-500' : 'bg-muted-foreground'}`}>
                      {attendee.name[0] || 'G'}
                    </div>
                    <div className="flex-1">
                      <input
                        value={attendee.name}
                        onChange={(e) => updateAttendee(idx, { name: e.target.value })}
                        className="bg-transparent font-bold text-lg w-full outline-none focus:border-b border-primary"
                      />
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="checkbox"
                          checked={attendee.is_key_person}
                          onChange={(e) => updateAttendee(idx, { is_key_person: e.target.checked })}
                          className="rounded accent-amber-500"
                        />
                        <span className="text-xs uppercase tracking-wider font-semibold opacity-70">Key Person</span>
                      </div>
                    </div>

                    {/* Score detail badge */}
                    {result?.individual_results?.find(r => r.user_id === attendee.user_id) && (
                      <div className="text-right">
                        <div className="text-[8px] uppercase font-black opacity-40">Match</div>
                        <div className="text-2xl font-black text-primary">
                          {result.individual_results.find(r => r.user_id === attendee.user_id)?.score}
                          <span className="text-[10px] opacity-40">/100</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Breakdown mini progress */}
                  {result?.individual_results?.find(r => r.user_id === attendee.user_id) && (
                    <div className="grid grid-cols-4 gap-1.5 py-3 border-y border-white/5">
                      {Object.entries(result.individual_results.find(r => r.user_id === attendee.user_id)!.breakdown).map(([key, data]) => (
                        <div key={key} className="space-y-1">
                          <div className="text-[6px] uppercase font-bold opacity-50 truncate">{key}</div>
                          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                            <div
                              style={{ width: `${(data.score / data.max) * 100}%` }}
                              className="h-full bg-primary"
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Focus Factors Priorities selector */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold opacity-60 block">Focus Factors (Priority Order)</label>
                    <p className="text-[8px] opacity-40 uppercase font-black">Tap factors in order of importance to set priorities</p>
                    <div className="flex flex-wrap gap-1">
                      {priorityFactors.map((factor) => {
                        const rankLabel = getRankLabel(attendee.preference.priorities, factor);
                        const isSelected = rankLabel !== "";
                        return (
                          <button
                            key={factor}
                            onClick={() => toggleAttendeePriority(idx, factor)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${isSelected ? 'bg-primary border-primary text-white scale-105 shadow-sm' : 'bg-white/5 border-white/10 opacity-50'}`}
                          >
                            {isSelected && (
                              <span className="inline-block px-1 py-0.5 rounded bg-white/20 text-[8px] font-black mr-1 text-[8px]">
                                {rankLabel}
                              </span>
                            )}
                            {factor}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Budget Dropdown */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold opacity-60 block">Budget / Person</label>
                    <select
                      value={attendee.preference.price}
                      onChange={(e) => updateAttendeePreference(idx, { price: e.target.value })}
                      className="glass-input w-full p-2.5 rounded-xl text-xs"
                    >
                      {config?.price.map((p: string) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>

                  {/* Meal Time Choice */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold opacity-60 block">Preferred Meal Time</label>
                    <div className="flex bg-white/5 rounded-xl p-1 gap-1 border border-white/5">
                      {['Lunch', 'Dinner', 'Any'].map((time) => (
                        <button
                          key={time}
                          onClick={() => updateAttendeePreference(idx, { meal_time: time })}
                          className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-all ${attendee.preference.meal_time === time ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground opacity-55 hover:bg-white/5'}`}
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Prefer Cuisine (Categories) */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-emerald-400 block">Preferred Cuisines</label>
                    <div className="flex flex-wrap gap-1">
                      {config?.category.map((c: string) => {
                        const isSelected = attendee.preference.category.includes(c);
                        const isAvoided = attendee.preference.avoid_categories.includes(c);
                        if (isAvoided) return null; // mutually exclusive logic
                        return (
                          <button
                            key={c}
                            onClick={() => {
                              const newCat = isSelected
                                ? attendee.preference.category.filter(cat => cat !== c)
                                : [...attendee.preference.category, c];
                              updateAttendeePreference(idx, { category: newCat });
                            }}
                            className={`px-2 py-1 rounded-full text-[10px] font-bold border transition-all ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white/5 border-white/10 opacity-50'}`}
                          >
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Avoid Cuisine (Avoid Categories) */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-rose-400 block">Avoid Cuisines</label>
                    <div className="flex flex-wrap gap-1">
                      {config?.category.map((c: string) => {
                        const isSelected = attendee.preference.category.includes(c);
                        const isAvoided = attendee.preference.avoid_categories.includes(c);
                        if (isSelected) return null; // mutually exclusive
                        return (
                          <button
                            key={c}
                            onClick={() => {
                              const newAvoid = isAvoided
                                ? attendee.preference.avoid_categories.filter(cat => cat !== c)
                                : [...attendee.preference.avoid_categories, c];
                              updateAttendeePreference(idx, { avoid_categories: newAvoid });
                            }}
                            className={`px-2 py-1 rounded-full text-[10px] font-bold border transition-all ${isAvoided ? 'bg-rose-500 border-rose-500 text-white' : 'bg-white/5 border-white/10 opacity-50'}`}
                          >
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Good For / Vibes */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold opacity-60 block">Vibe / Good For</label>
                    <div className="flex flex-wrap gap-1">
                      {config?.good_fors.map((g: string) => {
                        const isSelected = attendee.preference.good_fors.includes(g);
                        return (
                          <button
                            key={g}
                            onClick={() => {
                              const newG = isSelected
                                ? attendee.preference.good_fors.filter(gf => gf !== g)
                                : [...attendee.preference.good_fors, g];
                              updateAttendeePreference(idx, { good_fors: newG });
                            }}
                            className={`px-2 py-1 rounded-full text-[10px] font-bold border transition-all ${isSelected ? 'bg-accent border-accent text-white' : 'bg-white/5 border-white/10 opacity-50'}`}
                          >
                            {g}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Facilities Toggles */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      onClick={() => updateAttendeePreference(idx, { parking: !attendee.preference.parking })}
                      className={`p-2.5 rounded-xl border text-[10px] font-bold flex items-center justify-center gap-2 transition-all ${attendee.preference.parking ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' : 'bg-white/5 border-white/10 opacity-50'}`}
                    >
                      🚗 Parking Required
                    </button>
                    <button
                      onClick={() => updateAttendeePreference(idx, { alcohols: !attendee.preference.alcohols })}
                      className={`p-2.5 rounded-xl border text-[10px] font-bold flex items-center justify-center gap-2 transition-all ${attendee.preference.alcohols ? 'bg-pink-500/20 border-pink-500/50 text-pink-400' : 'bg-white/5 border-white/10 opacity-50'}`}
                    >
                      🍺 Alcohol Wanted
                    </button>
                  </div>

                  {/* Transit & Max Walk Distance */}
                  <div className="space-y-3 p-3.5 glass-panel rounded-xl">
                    <label className="text-[10px] uppercase font-bold opacity-60 block">Location & Transit</label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <div className="space-y-1">
                        <span className="text-[8px] opacity-50 block">Latitude</span>
                        <input
                          type="number" step="0.0001"
                          value={attendee.preference.lat}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            updateAttendeePreference(idx, { lat: isNaN(val) ? 0 : val });
                          }}
                          className="glass-input w-full p-2 rounded-lg text-[10px] font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[8px] opacity-50 block">Longitude</span>
                        <input
                          type="number" step="0.0001"
                          value={attendee.preference.lng}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            updateAttendeePreference(idx, { lng: isNaN(val) ? 0 : val });
                          }}
                          className="glass-input w-full p-2 rounded-lg text-[10px] font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[8px] opacity-50 block">Max Walk Distance (m)</span>
                      <select
                        value={attendee.preference.max_walk_distance}
                        onChange={(e) => updateAttendeePreference(idx, { max_walk_distance: Number(e.target.value) })}
                        className="glass-input w-full p-2 rounded-lg text-[10px]"
                      >
                        <option value={500}>500 m</option>
                        <option value={1000}>1000 m</option>
                        <option value={1500}>1500 m</option>
                        <option value={2000}>2000 m</option>
                      </select>
                    </div>
                  </div>

                  {/* Add Suggested Restaurants list */}
                  <div className="space-y-3 border-t border-white/5 pt-3">
                    <label className="text-[10px] uppercase font-bold opacity-60 block">Prefer Restaurants (Optional)</label>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {attendee.preference.preferred_restaurant.map((rest: any) => (
                        <span key={rest.name} className="px-2 py-1 rounded-full text-[8px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1.5">
                          {rest.name}
                          <button
                            onClick={() => {
                              const list = attendee.preference.preferred_restaurant.filter(r => r.name !== rest.name);
                              updateAttendeePreference(idx, { preferred_restaurant: list });
                            }}
                            className="hover:text-white"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>

                    <div className="relative">
                      <input
                        placeholder="Search venues for attendee..."
                        value={attendeeSearchTerms[attendee.user_id] || ""}
                        onChange={(e) => searchAttendeeRestaurant(attendee.user_id, e.target.value)}
                        className="glass-input w-full p-2 rounded-lg text-xs"
                      />
                      {attendeeSearchResults[attendee.user_id]?.length > 0 && (
                        <div className="absolute left-0 right-0 z-50 glass-panel mt-1 rounded-xl max-h-40 overflow-y-auto shadow-2xl border border-white/10 bg-black/90">
                          {attendeeSearchResults[attendee.user_id].map((res: any) => (
                            <button
                              key={res.id}
                              onClick={() => {
                                const list = attendee.preference.preferred_restaurant;
                                if (!list.some(r => r.name === res.name)) {
                                  updateAttendeePreference(idx, { preferred_restaurant: [...list, res] });
                                }
                                setAttendeeSearchTerms(prev => ({ ...prev, [attendee.user_id]: "" }));
                                setAttendeeSearchResults(prev => ({ ...prev, [attendee.user_id]: [] }));
                              }}
                              className="w-full text-left p-2.5 hover:bg-primary/20 border-b border-white/5 last:border-0 transition-colors"
                            >
                              <div className="font-bold text-[11px] text-white">{res.name}</div>
                              <div className="text-[9px] opacity-50">{res.price} • {res.category?.[0]}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Restaurant & Result */}
        <div className="space-y-8">
          <div className="glass-panel p-6 rounded-2xl space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              🏪 Restaurant To Test
            </h2>

            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative space-y-1">
                <label className="text-[10px] uppercase font-bold opacity-50">Search Existing Restaurant</label>
                <input
                  placeholder="Type name (e.g. Starbucks...)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="glass-input w-full p-3 rounded-xl font-bold border-accent/30"
                />
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 glass-panel mt-1 rounded-xl overflow-hidden shadow-2xl">
                    {searchResults.map((res: any) => (
                      <button
                        key={res.id}
                        onClick={() => selectRestaurantForTest(res)}
                        className="w-full text-left p-3 hover:bg-primary/10 border-b border-white/5 last:border-0 transition-colors"
                      >
                        <div className="font-bold text-sm">{res.name}</div>
                        <div className="text-[10px] opacity-50">{res.price} • {res.category?.join(', ')}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="h-px bg-white/10 my-2"></div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold opacity-50">Restaurant Name</label>
                <input
                  value={restaurant.name}
                  onChange={(e) => setRestaurant({ ...restaurant, name: e.target.value })}
                  className="glass-input w-full p-3 rounded-xl font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold opacity-50">Price Point</label>
                  <select
                    value={restaurant.price}
                    onChange={(e) => setRestaurant({ ...restaurant, price: e.target.value })}
                    className="glass-input w-full p-3 rounded-xl text-sm"
                  >
                    {config?.price.map((p: string) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold opacity-50">Rating</label>
                  <input
                    type="number" step="0.1" min="0" max="5"
                    value={restaurant.rating}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setRestaurant({ ...restaurant, rating: isNaN(val) ? 0 : val });
                    }}
                    className="glass-input w-full p-3 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold opacity-50">Categories (Multi-select)</label>
                <div className="flex flex-wrap gap-1">
                  {config?.category.map((c: string) => {
                    const isSelected = restaurant.category.includes(c);
                    return (
                      <button
                        key={c}
                        onClick={() => {
                          const newCat = isSelected
                            ? restaurant.category.filter(cat => cat !== c)
                            : [...restaurant.category, c];
                          setRestaurant({ ...restaurant, category: newCat });
                        }}
                        className={`px-2 py-1 rounded-full text-[10px] font-bold border transition-all ${isSelected ? 'bg-primary border-primary text-white' : 'bg-white/5 border-white/10 opacity-50'}`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold opacity-50">Good For / Vibe (Multi-select)</label>
                <div className="flex flex-wrap gap-1">
                  {config?.good_fors.map((g: string) => {
                    const isSelected = restaurant.good_fors.includes(g);
                    return (
                      <button
                        key={g}
                        onClick={() => {
                          const newG = isSelected
                            ? restaurant.good_fors.filter(gf => gf !== g)
                            : [...restaurant.good_fors, g];
                          setRestaurant({ ...restaurant, good_fors: newG });
                        }}
                        className={`px-2 py-1 rounded-full text-[10px] font-bold border transition-all ${isSelected ? 'bg-accent border-accent text-white' : 'bg-white/5 border-white/10 opacity-50'}`}
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 glass-input rounded-xl">
                <span className="text-sm font-bold">Has Parking?</span>
                <input
                  type="checkbox"
                  checked={restaurant.parking === "มีที่จอดรถ" || restaurant.parking === "Yes"}
                  onChange={(e) => setRestaurant({ ...restaurant, parking: e.target.checked ? "มีที่จอดรถ" : "ไม่มีที่จอดรถ" })}
                  className="w-5 h-5 accent-primary"
                />
              </div>

              <div className="space-y-1 p-3 glass-panel rounded-xl">
                <label className="text-[10px] uppercase font-bold opacity-50 block">Coordinates (Lat, Lng)</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div className="space-y-1">
                    <span className="text-[8px] opacity-50">Latitude</span>
                    <input 
                      type="number" step="0.0001"
                      value={restaurant.lat}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setRestaurant({ ...restaurant, lat: isNaN(val) ? 0 : val });
                      }}
                      className="glass-input w-full p-2 rounded-lg text-[10px] font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[8px] opacity-50">Longitude</span>
                    <input 
                      type="number" step="0.0001"
                      value={restaurant.lng}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setRestaurant({ ...restaurant, lng: isNaN(val) ? 0 : val });
                      }}
                      className="glass-input w-full p-2 rounded-lg text-[10px] font-mono"
                    />
                  </div>
                </div>
                <div className="text-[10px] text-primary font-bold mt-2 flex justify-between items-center">
                  <span>Affects "Station" proximity score</span>
                  {(() => {
                    if (!config?.stations || !restaurant.lat || !restaurant.lng) return null;
                    
                    let minD = Infinity;
                    let nearest = "";
                    
                    const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
                      const R = 6371;
                      const dLat = (lat2 - lat1) * Math.PI / 180;
                      const dLon = (lon2 - lon1) * Math.PI / 180;
                      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                                Math.sin(dLon/2) * Math.sin(dLon/2);
                      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                      return R * c;
                    };

                    config.stations.forEach((s: any) => {
                      const d = haversine(restaurant.lat, restaurant.lng, s.lat, s.lng);
                      if (d < minD) {
                        minD = d;
                        nearest = s.name;
                      }
                    });

                    return (
                      <span className="text-[8px] bg-primary/20 px-1.5 py-0.5 rounded animate-pulse">
                        Nearest: {nearest} ({minD.toFixed(2)}km)
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* Result Card */}
          {result && (
            <div className="glass-panel p-8 rounded-3xl space-y-6 border-t-4 border-primary overflow-hidden relative">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary opacity-20 blur-3xl rounded-full"></div>

              <div className="text-center space-y-2 relative">
                <h3 className="text-sm uppercase font-black tracking-widest opacity-50">Final Dishcision Score</h3>
                <div className="text-7xl font-black text-primary drop-shadow-lg">
                  {result.final_score}<span className="text-2xl opacity-50">/100</span>
                </div>
              </div>

              <div className="space-y-4 relative">
                <h4 className="text-xs font-bold uppercase opacity-50 border-b border-white/10 pb-2">Scoring Breakdown</h4>
                <div className="space-y-3">
                  {result.reason_breakdown && Object.entries(result.reason_breakdown).map(([key, data]: [string, any]) => (
                    <div key={key} className="space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <div className="flex items-center gap-2">
                          <span>{key}</span>
                          {key === "Station" && data.nearest_station && (
                            <span className="text-[8px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-mono">
                              {data.nearest_station} ({data.dist_km}km)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-primary font-bold">{data.weighted_score}</span>
                          <span className="opacity-30 text-[10px]">/</span>
                          <span className="opacity-50 font-bold">{data.max_score?.toFixed(1)}</span>
                          <span className="text-[8px] opacity-40 bg-white/5 px-1 rounded">Base: {data.base_score}</span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden flex">
                        <div
                          style={{ width: `${(data.weighted_score / (data.max_score || 1)) * 100}%` }}
                          className="h-full bg-gradient-to-r from-primary to-accent"
                        ></div>
                      </div>
                      <div className="flex justify-between text-[8px] opacity-40 uppercase font-black">
                        <span>Key: {data.key_ratio?.toFixed(1) || 0}</span>
                        <span>General: {data.attendee_ratio?.toFixed(1) || 0}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4 relative">
                <h4 className="text-xs font-bold uppercase opacity-50 border-b border-white/10 pb-2">Dynamic Weights (Boosted)</h4>
                <div className="grid grid-cols-2 gap-2">
                  {result.dynamic_weights && Object.entries(result.dynamic_weights).map(([key, weight]: [string, any]) => (
                    <div key={key} className="p-2 glass-input rounded-lg flex justify-between items-center">
                      <span className="text-[10px] font-bold">{key}</span>
                      <span className="text-xs font-black text-accent">{weight?.toFixed(1) || 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
