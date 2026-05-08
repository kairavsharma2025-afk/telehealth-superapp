import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ScreenHeader } from "../../components/ScreenHeader";
import { semantic, space } from "../../theme";
import { useTabRouter } from "../../navigation/router";
import { StepBar } from "./StepBar";
import { StepSpecialty } from "./StepSpecialty";
import { StepDoctorAndTime } from "./StepDoctorAndTime";
import { StepReviewPay } from "./StepReviewPay";
import {
  doctorDisplayName,
  type AvailableDoctor,
  type DoctorSlot,
  type Step,
} from "./shared";

// Top-level orchestrator for the 3-step Book a Doctor wizard. Holds
// cross-step state (selected specialty, doctor, slot) and keeps the
// progress bar in sync.

export function BookScreen() {
  const { navigate } = useTabRouter();
  const [step, setStep] = useState<Step>(1);
  const [specialty, setSpecialty] = useState<string | null>(null);
  const [doctor, setDoctor] = useState<AvailableDoctor | null>(null);
  const [slot, setSlot] = useState<DoctorSlot | null>(null);

  const reset = () => {
    setStep(1);
    setSpecialty(null);
    setDoctor(null);
    setSlot(null);
  };

  const goToAppointments = () => {
    reset();
    navigate("Appointments");
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <ScreenHeader
        title="Book a doctor"
        subtitle={
          step === 1
            ? "Step 1 of 3 — choose what kind of doctor you need."
            : step === 2
              ? "Step 2 of 3 — pick the doctor and time that fits."
              : "Step 3 of 3 — confirm your booking and pay."
        }
      />

      <StepBar current={step} />

      {step === 1 ? (
        <StepSpecialty
          selected={specialty}
          onSelect={setSpecialty}
          onContinue={() => {
            if (specialty) setStep(2);
          }}
        />
      ) : step === 2 ? (
        specialty ? (
          <StepDoctorAndTime
            specialty={specialty}
            selectedDoctorId={doctor?.id ?? null}
            selectedSlot={slot}
            selectedDoctorName={doctor ? doctorDisplayName(doctor) : ""}
            onChangeSpecialty={() => setStep(1)}
            onSelect={(d, s) => {
              setDoctor(d);
              setSlot(s);
            }}
            onContinue={() => {
              if (doctor && slot) setStep(3);
            }}
            onBack={() => setStep(1)}
          />
        ) : (
          <View style={styles.fallback}>
            <Text>Choose a specialty first.</Text>
          </View>
        )
      ) : doctor && slot ? (
        <StepReviewPay
          doctor={doctor}
          slot={slot}
          duration={
            Math.round(
              (new Date(slot.endAt).getTime() -
                new Date(slot.startAt).getTime()) /
                60_000,
            ) === 60
              ? 60
              : Math.round(
                    (new Date(slot.endAt).getTime() -
                      new Date(slot.startAt).getTime()) /
                      60_000,
                  ) === 45
                ? 45
                : 30
          }
          onBack={() => setStep(2)}
          onAnotherBooking={reset}
          onViewAppointments={goToAppointments}
        />
      ) : (
        <View style={styles.fallback}>
          <Text>Pick a doctor & time first.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: semantic.bg },
  content: { padding: space[5] },
  fallback: { padding: space[6] },
});
