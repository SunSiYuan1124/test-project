const { createApp } = Vue;

createApp({
  data() {
    return {
      assignments: [],
      filter: "all",
      keyword: "",
      saving: false,
      error: "",
      form: {
        subject: "",
        title: "",
        dueDate: new Date().toISOString().slice(0, 10),
        description: ""
      }
    };
  },
  computed: {
    pendingCount() {
      return this.assignments.filter((item) => item.status !== "done").length;
    },
    completionRate() {
      if (this.assignments.length === 0) {
        return 0;
      }
      const doneCount = this.assignments.length - this.pendingCount;
      return Math.round((doneCount / this.assignments.length) * 100);
    },
    filteredAssignments() {
      const keyword = this.keyword.toLowerCase();
      return this.assignments.filter((item) => {
        const statusMatched = this.filter === "all" || item.status === this.filter;
        const keywordMatched = !keyword
          || item.subject.toLowerCase().includes(keyword)
          || item.title.toLowerCase().includes(keyword)
          || item.description.toLowerCase().includes(keyword);
        return statusMatched && keywordMatched;
      });
    }
  },
  async mounted() {
    await this.fetchAssignments();
  },
  methods: {
    async fetchAssignments() {
      const response = await fetch("/api/assignments");
      this.assignments = await response.json();
    },
    async createAssignment() {
      this.error = "";
      this.saving = true;
      try {
        const response = await fetch("/api/assignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(this.form)
        });

        if (!response.ok) {
          const payload = await response.json();
          throw new Error(payload.message || "发布失败");
        }

        await this.fetchAssignments();
        this.form.title = "";
        this.form.description = "";
      } catch (error) {
        this.error = error.message;
      } finally {
        this.saving = false;
      }
    },
    async toggleStatus(item) {
      const nextStatus = item.status === "done" ? "todo" : "done";
      await fetch(`/api/assignments/${item.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });
      item.status = nextStatus;
    },
    async removeAssignment(id) {
      await fetch(`/api/assignments/${id}`, { method: "DELETE" });
      this.assignments = this.assignments.filter((item) => item.id !== id);
    },
    formatDate(value) {
      return new Intl.DateTimeFormat("zh-CN", {
        month: "short",
        day: "numeric",
        weekday: "short"
      }).format(new Date(`${value}T00:00:00`));
    },
    isUrgent(value) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(`${value}T00:00:00`);
      const diff = (dueDate - today) / 86400000;
      return diff <= 1;
    }
  }
}).mount("#app");
