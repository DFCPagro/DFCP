rs.initiate({
  _id: "rs0",
  members: [{ _id: 0, host: "mongo:27017" }]
});

(function waitPrimary() {
  while (true) {
    try {
      const s = rs.status();
      if (s.ok === 1 && s.members && s.members.some(m => m.stateStr === "PRIMARY")) {
        print("Replica set PRIMARY ready");
        break;
      }
    } catch (e) {}
    sleep(500);
  }
})();