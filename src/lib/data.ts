import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import car from "@/assets/car.jpg";
import moto from "@/assets/moto.jpg";
import interior from "@/assets/interior.jpg";
import pickup from "@/assets/pickup.jpg";
import shower from "@/assets/shower.jpg";

export const SERVICE_IMAGES: Record<string, string> = {
  car,
  moto,
  interior,
  pickup,
  shower,
  suv: shower,
};

export function serviceImage(s: { image_key: string; image_url: string | null }) {
  return s.image_url || SERVICE_IMAGES[s.image_key] || car;
}

export function useServices() {
  return useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*").eq("id", 1).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useAvailability(date: string | null) {
  return useQuery({
    queryKey: ["availability", date],
    enabled: !!date,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_availability", { _date: date! });
      if (error) throw error;
      return data as { slot_time: string; state: "free" | "booked" | "blocked" | "past" }[];
    },
  });
}

export function useProfessionals() {
  return useQuery({
    queryKey: ["professionals"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("id, name, whatsapp, active, updated_at")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data.map((professional) => ({
        id: professional.id,
        name: professional.name,
        phone: professional.whatsapp,
        active: professional.active,
      }));
    },
  });
}
