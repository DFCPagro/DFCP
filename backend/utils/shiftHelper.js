const { DateTime } = require("luxon");
const { admin, db } = require("../firebaseConfig");

function parseTimeStr(timeStr) {
  const [hour, minute] = timeStr.split(":").map(Number);
  return { hour, minute };
}

async function getUpcomingShiftsList(db, count = 6) {
  // Load shifts from Firestore
  const shiftsSnap = await db.collection("shifts").get();
  if (shiftsSnap.empty) throw new Error("No shifts defined.");

  let shifts = [];
  shiftsSnap.forEach(doc => {
    const data = doc.data();
    shifts.push({
      name: doc.id.toLowerCase(),
      start: data.start,
      end: data.end
    });
  });

  shifts.sort((a, b) => {
    const timeA = parseTimeStr(a.start).hour * 60 + parseTimeStr(a.start).minute;
    const timeB = parseTimeStr(b.start).hour * 60 + parseTimeStr(b.start).minute;
    return timeA - timeB;
  });

  const now = DateTime.local();
  let dayCursor = now;
  let foundCurrent = false;
  const upcomingShifts = [];

  while (upcomingShifts.length < count) {
    const dateStr = dayCursor.toISODate().replace(/-/g, "_");

    for (const shift of shifts) {
      const { hour: startHour, minute: startMinute } = parseTimeStr(shift.start);
      const { hour: endHour, minute: endMinute } = parseTimeStr(shift.end);

      let shiftStartTime = dayCursor.set({
        hour: startHour, minute: startMinute, second: 0, millisecond: 0
      });

      let shiftEndTime = dayCursor.set({
        hour: endHour, minute: endMinute, second: 0, millisecond: 0
      });

      if (endHour < startHour || (endHour === startHour && endMinute < startMinute)) {
        shiftEndTime = shiftEndTime.plus({ days: 1 });
      }

      if (!foundCurrent) {
        if (shiftStartTime <= now && now < shiftEndTime) {
          upcomingShifts.push({ date: dateStr, shift: shift.name });
          foundCurrent = true;
        } else if (shiftStartTime > now) {
          upcomingShifts.push({ date: dateStr, shift: shift.name });
          foundCurrent = true;
        }
      } else {
        upcomingShifts.push({ date: dateStr, shift: shift.name });
      }

      if (upcomingShifts.length === count) break;
    }

    dayCursor = dayCursor.plus({ days: 1 });
  }

  return upcomingShifts;
}

module.exports = {
  getUpcomingShiftsList
};
