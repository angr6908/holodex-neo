<template>
    <div>
        <span class="text">
            {{ text }}
        </span>
        <span class="remove" @click="$emit('removeItem', text)">x</span>
    </div>
</template>
<style>
.remove {
    position: absolute;
    right: 2px;
    top: 0;
    cursor: pointer;
}
</style>
<script setup lang="ts">
import { onMounted } from "vue";

const props = withDefaults(defineProps<{ text?: string }>(), {
    text: "x",
});

const emit = defineEmits<{
    (e: "removeItem", text: string): void;
}>();

onMounted(() => {
    console.log("### " + props.text + " ready!");
});
</script>
